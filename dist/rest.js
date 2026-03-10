"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startRestServer = startRestServer;
const express_1 = __importDefault(require("express"));
const svd_parser_js_1 = require("./svd-parser.js");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const router = express_1.default.Router();
    // GET /health
    router.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });
    // GET /peripherals?svd=<path>
    router.get("/peripherals", (req, res) => {
        const svdPath = req.query["svd"];
        if (!svdPath) {
            res.status(400).json({ error: 'Missing required query parameter "svd"' });
            return;
        }
        try {
            const device = (0, svd_parser_js_1.loadSvd)(svdPath);
            const peripherals = device.peripherals.map((p) => ({
                name: p.name,
                baseAddress: `0x${p.baseAddress.toString(16).toUpperCase().padStart(8, "0")}`,
                description: p.description,
            }));
            res.json({ device: device.name, peripherals });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /registers/:peripheral?svd=<path>
    router.get("/registers/:peripheral", (req, res) => {
        const svdPath = req.query["svd"];
        const peripheralName = req.params["peripheral"];
        if (!svdPath) {
            res.status(400).json({ error: 'Missing required query parameter "svd"' });
            return;
        }
        try {
            const device = (0, svd_parser_js_1.loadSvd)(svdPath);
            const peripheral = device.peripherals.find((p) => p.name.toLowerCase() === peripheralName.toLowerCase());
            if (!peripheral) {
                res.status(404).json({
                    error: `Peripheral "${peripheralName}" not found in ${device.name}`,
                });
                return;
            }
            const registers = peripheral.registers.map((r) => ({
                name: r.name,
                addressOffset: `0x${r.addressOffset.toString(16).toUpperCase().padStart(3, "0")}`,
                absoluteAddress: `0x${(peripheral.baseAddress + r.addressOffset).toString(16).toUpperCase().padStart(8, "0")}`,
                description: r.description,
                access: r.access,
                size: r.size,
                resetValue: r.resetValue !== undefined ? `0x${r.resetValue.toString(16).toUpperCase().padStart(8, "0")}` : undefined,
            }));
            res.json({ peripheral: peripheral.name, registers });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /field/:peripheral/:register/:field?svd=<path>
    router.get("/field/:peripheral/:register/:field", (req, res) => {
        const svdPath = req.query["svd"];
        const { peripheral: peripheralName, register: registerName, field: fieldName } = req.params;
        if (!svdPath) {
            res.status(400).json({ error: 'Missing required query parameter "svd"' });
            return;
        }
        try {
            const device = (0, svd_parser_js_1.loadSvd)(svdPath);
            const peripheral = device.peripherals.find((p) => p.name.toLowerCase() === peripheralName.toLowerCase());
            if (!peripheral) {
                res.status(404).json({ error: `Peripheral "${peripheralName}" not found` });
                return;
            }
            const register = peripheral.registers.find((r) => r.name.toLowerCase() === registerName.toLowerCase());
            if (!register) {
                res.status(404).json({ error: `Register "${registerName}" not found in peripheral "${peripheralName}"` });
                return;
            }
            const field = register.fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
            if (!field) {
                res.status(404).json({ error: `Field "${fieldName}" not found in register "${registerName}"` });
                return;
            }
            res.json({
                peripheral: peripheral.name,
                register: register.name,
                field: {
                    name: field.name,
                    description: field.description,
                    bitOffset: field.bitOffset,
                    bitWidth: field.bitWidth,
                    mask: `0x${(((1 << field.bitWidth) - 1) << field.bitOffset).toString(16).toUpperCase()}`,
                    access: field.access,
                    enumeratedValues: field.enumeratedValues,
                },
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.use("/api/v1", router);
    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({ error: "Not found" });
    });
    // Error handler
    app.use((err, _req, res, _next) => {
        res.status(500).json({ error: err.message });
    });
    return app;
}
function startRestServer(port) {
    const app = createApp();
    app.listen(port, () => {
        process.stderr.write(`[mcp-svd] REST API listening on http://localhost:${port}/api/v1\n`);
    });
}
//# sourceMappingURL=rest.js.map