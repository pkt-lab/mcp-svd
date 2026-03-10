import { readFileSync } from "fs";
import { XMLParser } from "fast-xml-parser";

export interface SvdEnumeratedValue {
  name: string;
  description?: string;
  value: string;
}

export interface SvdField {
  name: string;
  description?: string;
  bitOffset: number;
  bitWidth: number;
  access?: string;
  enumeratedValues?: SvdEnumeratedValue[];
}

export interface SvdRegister {
  name: string;
  description?: string;
  addressOffset: number;
  size?: number;
  access?: string;
  resetValue?: number;
  fields: SvdField[];
}

export interface SvdPeripheral {
  name: string;
  description?: string;
  baseAddress: number;
  registers: SvdRegister[];
}

export interface SvdDevice {
  name: string;
  description?: string;
  peripherals: SvdPeripheral[];
}

const cache = new Map<string, SvdDevice>();

function parseHex(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  const s = String(val).trim();
  if (s.startsWith("0x") || s.startsWith("0X")) return parseInt(s, 16);
  return parseInt(s, 10) || 0;
}

function str(val: unknown): string | undefined {
  if (val === undefined || val === null) return undefined;
  return String(val).trim() || undefined;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function parseFields(fieldsRaw: unknown): SvdField[] {
  if (!fieldsRaw || typeof fieldsRaw !== "object") return [];
  const raw = fieldsRaw as Record<string, unknown>;
  const fieldList = toArray(raw["field"] as unknown);

  return fieldList.map((f) => {
    const field = f as Record<string, unknown>;
    const bitRange = str(field["bitRange"]);
    let bitOffset = parseHex(field["bitOffset"] as string | number | undefined);
    let bitWidth = parseHex(field["bitWidth"] as string | number | undefined);

    if (bitRange) {
      // format: [msb:lsb]
      const m = bitRange.match(/\[(\d+):(\d+)\]/);
      if (m) {
        const msb = parseInt(m[1], 10);
        const lsb = parseInt(m[2], 10);
        bitOffset = lsb;
        bitWidth = msb - lsb + 1;
      }
    }

    const enumValsRaw = field["enumeratedValues"] as Record<string, unknown> | undefined;
    const enumeratedValues: SvdEnumeratedValue[] = [];
    if (enumValsRaw) {
      const evList = toArray(enumValsRaw["enumeratedValue"] as unknown);
      for (const ev of evList) {
        const evObj = ev as Record<string, unknown>;
        enumeratedValues.push({
          name: str(evObj["name"]) ?? "",
          description: str(evObj["description"]),
          value: str(evObj["value"]) ?? "",
        });
      }
    }

    return {
      name: str(field["name"]) ?? "UNKNOWN",
      description: str(field["description"]),
      bitOffset,
      bitWidth,
      access: str(field["access"]),
      enumeratedValues: enumeratedValues.length > 0 ? enumeratedValues : undefined,
    };
  });
}

function parseRegisters(registersRaw: unknown): SvdRegister[] {
  if (!registersRaw || typeof registersRaw !== "object") return [];
  const raw = registersRaw as Record<string, unknown>;
  const regList = toArray(raw["register"] as unknown);

  return regList.map((r) => {
    const reg = r as Record<string, unknown>;
    return {
      name: str(reg["name"]) ?? "UNKNOWN",
      description: str(reg["description"]),
      addressOffset: parseHex(reg["addressOffset"] as string | number | undefined),
      size: reg["size"] !== undefined ? parseHex(reg["size"] as string | number | undefined) : undefined,
      access: str(reg["access"]),
      resetValue: reg["resetValue"] !== undefined ? parseHex(reg["resetValue"] as string | number | undefined) : undefined,
      fields: parseFields(reg["fields"]),
    };
  });
}

function parsePeripherals(peripheralsRaw: unknown, allPeripherals: Record<string, unknown>[]): SvdPeripheral[] {
  const result: SvdPeripheral[] = [];

  for (const p of peripheralsRaw as Record<string, unknown>[]) {
    const periph = p as Record<string, unknown>;
    let registers: SvdRegister[] = [];

    const derivedFrom = str(periph["@_derivedFrom"]);
    if (derivedFrom) {
      // Inherit registers from base peripheral
      const base = (peripheralsRaw as Record<string, unknown>[]).find(
        (x) => str((x as Record<string, unknown>)["name"]) === derivedFrom
      );
      if (base) {
        const baseObj = base as Record<string, unknown>;
        registers = parseRegisters(baseObj["registers"]);
      }
    } else {
      registers = parseRegisters(periph["registers"]);
    }

    result.push({
      name: str(periph["name"]) ?? "UNKNOWN",
      description: str(periph["description"]),
      baseAddress: parseHex(periph["baseAddress"] as string | number | undefined),
      registers,
    });
  }

  return result;
}

export function loadSvd(filePath: string): SvdDevice {
  if (cache.has(filePath)) {
    return cache.get(filePath)!;
  }

  let xml: string;
  try {
    xml = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Cannot read SVD file "${filePath}": ${(err as NodeJS.ErrnoException).message}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: true,
    trimValues: true,
    isArray: (tagName) =>
      ["peripheral", "register", "field", "enumeratedValue", "cluster"].includes(tagName),
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to parse SVD XML in "${filePath}": ${(err as Error).message}`);
  }

  const deviceRaw = parsed["device"] as Record<string, unknown> | undefined;
  if (!deviceRaw) {
    throw new Error(`SVD file "${filePath}" does not contain a <device> root element`);
  }

  const peripheralsContainer = deviceRaw["peripherals"] as Record<string, unknown> | undefined;
  const peripheralList = peripheralsContainer
    ? toArray(peripheralsContainer["peripheral"] as unknown)
    : [];

  const device: SvdDevice = {
    name: str(deviceRaw["name"]) ?? "Unknown Device",
    description: str(deviceRaw["description"]),
    peripherals: parsePeripherals(peripheralList, peripheralList as Record<string, unknown>[]),
  };

  cache.set(filePath, device);
  return device;
}

export function clearCache(filePath?: string): void {
  if (filePath) {
    cache.delete(filePath);
  } else {
    cache.clear();
  }
}
