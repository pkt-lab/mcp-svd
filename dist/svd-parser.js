"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSvd = loadSvd;
exports.clearCache = clearCache;
const fs_1 = require("fs");
const fast_xml_parser_1 = require("fast-xml-parser");
const cache = new Map();
function parseHex(val) {
    if (val === undefined || val === null)
        return 0;
    const s = String(val).trim();
    if (s.startsWith("0x") || s.startsWith("0X"))
        return parseInt(s, 16);
    return parseInt(s, 10) || 0;
}
function str(val) {
    if (val === undefined || val === null)
        return undefined;
    return String(val).trim() || undefined;
}
function toArray(val) {
    if (val === undefined || val === null)
        return [];
    return Array.isArray(val) ? val : [val];
}
function parseFields(fieldsRaw) {
    if (!fieldsRaw || typeof fieldsRaw !== "object")
        return [];
    const raw = fieldsRaw;
    const fieldList = toArray(raw["field"]);
    return fieldList.map((f) => {
        const field = f;
        const bitRange = str(field["bitRange"]);
        let bitOffset = parseHex(field["bitOffset"]);
        let bitWidth = parseHex(field["bitWidth"]);
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
        const enumValsRaw = field["enumeratedValues"];
        const enumeratedValues = [];
        if (enumValsRaw) {
            const evList = toArray(enumValsRaw["enumeratedValue"]);
            for (const ev of evList) {
                const evObj = ev;
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
function parseRegisters(registersRaw) {
    if (!registersRaw || typeof registersRaw !== "object")
        return [];
    const raw = registersRaw;
    const regList = toArray(raw["register"]);
    return regList.map((r) => {
        const reg = r;
        return {
            name: str(reg["name"]) ?? "UNKNOWN",
            description: str(reg["description"]),
            addressOffset: parseHex(reg["addressOffset"]),
            size: reg["size"] !== undefined ? parseHex(reg["size"]) : undefined,
            access: str(reg["access"]),
            resetValue: reg["resetValue"] !== undefined ? parseHex(reg["resetValue"]) : undefined,
            fields: parseFields(reg["fields"]),
        };
    });
}
function parsePeripherals(peripheralsRaw, allPeripherals) {
    const result = [];
    for (const p of peripheralsRaw) {
        const periph = p;
        let registers = [];
        const derivedFrom = str(periph["@_derivedFrom"]);
        if (derivedFrom) {
            // Inherit registers from base peripheral
            const base = peripheralsRaw.find((x) => str(x["name"]) === derivedFrom);
            if (base) {
                const baseObj = base;
                registers = parseRegisters(baseObj["registers"]);
            }
        }
        else {
            registers = parseRegisters(periph["registers"]);
        }
        result.push({
            name: str(periph["name"]) ?? "UNKNOWN",
            description: str(periph["description"]),
            baseAddress: parseHex(periph["baseAddress"]),
            registers,
        });
    }
    return result;
}
function loadSvd(filePath) {
    if (cache.has(filePath)) {
        return cache.get(filePath);
    }
    let xml;
    try {
        xml = (0, fs_1.readFileSync)(filePath, "utf-8");
    }
    catch (err) {
        throw new Error(`Cannot read SVD file "${filePath}": ${err.message}`);
    }
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: false,
        parseTagValue: true,
        trimValues: true,
        isArray: (tagName) => ["peripheral", "register", "field", "enumeratedValue", "cluster"].includes(tagName),
    });
    let parsed;
    try {
        parsed = parser.parse(xml);
    }
    catch (err) {
        throw new Error(`Failed to parse SVD XML in "${filePath}": ${err.message}`);
    }
    const deviceRaw = parsed["device"];
    if (!deviceRaw) {
        throw new Error(`SVD file "${filePath}" does not contain a <device> root element`);
    }
    const peripheralsContainer = deviceRaw["peripherals"];
    const peripheralList = peripheralsContainer
        ? toArray(peripheralsContainer["peripheral"])
        : [];
    const device = {
        name: str(deviceRaw["name"]) ?? "Unknown Device",
        description: str(deviceRaw["description"]),
        peripherals: parsePeripherals(peripheralList, peripheralList),
    };
    cache.set(filePath, device);
    return device;
}
function clearCache(filePath) {
    if (filePath) {
        cache.delete(filePath);
    }
    else {
        cache.clear();
    }
}
//# sourceMappingURL=svd-parser.js.map