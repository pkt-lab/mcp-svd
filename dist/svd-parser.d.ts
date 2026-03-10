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
export declare function loadSvd(filePath: string): SvdDevice;
export declare function clearCache(filePath?: string): void;
//# sourceMappingURL=svd-parser.d.ts.map