import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadSvd, SvdPeripheral, SvdRegister, SvdField } from "./svd-parser.js";
import { startRestServer } from "./rest.js";

const server = new Server(
  {
    name: "mcp-svd",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_peripherals",
        description:
          "List all peripherals defined in an ARM CMSIS SVD file. Returns each peripheral's name, base address, and description. Use this to discover what hardware blocks are available in a microcontroller.",
        inputSchema: {
          type: "object",
          properties: {
            svd_file: {
              type: "string",
              description: "Absolute or relative path to the .svd file",
            },
          },
          required: ["svd_file"],
        },
      },
      {
        name: "lookup_register",
        description:
          "Get full details for a specific register within a peripheral, including address offset, size, access type, reset value, and all bit-fields with their positions. Use this when you need exact register layout for low-level firmware code.",
        inputSchema: {
          type: "object",
          properties: {
            svd_file: {
              type: "string",
              description: "Absolute or relative path to the .svd file",
            },
            peripheral: {
              type: "string",
              description: "Peripheral name (e.g. GPIOA, UART0, SPI1)",
            },
            register: {
              type: "string",
              description: "Register name (e.g. CR1, MODER, CONFIG)",
            },
          },
          required: ["svd_file", "peripheral", "register"],
        },
      },
      {
        name: "describe_field",
        description:
          "Describe a specific bit-field within a register: its bit offset, width, access type, and enumerated values if defined. Use this when you need to understand or set a specific control bit or flag.",
        inputSchema: {
          type: "object",
          properties: {
            svd_file: {
              type: "string",
              description: "Absolute or relative path to the .svd file",
            },
            peripheral: {
              type: "string",
              description: "Peripheral name (e.g. GPIOA, UART0)",
            },
            register: {
              type: "string",
              description: "Register name (e.g. CR1, MODER)",
            },
            field: {
              type: "string",
              description: "Field name (e.g. UE, MODE0, RXNEIE)",
            },
          },
          required: ["svd_file", "peripheral", "register", "field"],
        },
      },
      {
        name: "search_registers",
        description:
          "Search across all peripherals and registers in an SVD file using a case-insensitive substring match. Returns up to 10 matches with peripheral name, register name, and description. Use this when you know part of a register name but not which peripheral it belongs to.",
        inputSchema: {
          type: "object",
          properties: {
            svd_file: {
              type: "string",
              description: "Absolute or relative path to the .svd file",
            },
            query: {
              type: "string",
              description: "Search string matched against peripheral and register names (case-insensitive substring)",
            },
          },
          required: ["svd_file", "query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args || typeof args !== "object") {
    throw new Error("Missing tool arguments");
  }

  const toolArgs = args as Record<string, string>;

  try {
    switch (name) {
      case "list_peripherals": {
        const { svd_file } = toolArgs;
        if (!svd_file) throw new Error('Required argument "svd_file" is missing');
        const device = loadSvd(svd_file);
        const peripherals = device.peripherals.map((p: SvdPeripheral) => ({
          name: p.name,
          baseAddress: `0x${p.baseAddress.toString(16).toUpperCase().padStart(8, "0")}`,
          description: p.description ?? "",
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { device: device.name, count: peripherals.length, peripherals },
                null,
                2
              ),
            },
          ],
        };
      }

      case "lookup_register": {
        const { svd_file, peripheral: peripheralName, register: registerName } = toolArgs;
        if (!svd_file) throw new Error('Required argument "svd_file" is missing');
        if (!peripheralName) throw new Error('Required argument "peripheral" is missing');
        if (!registerName) throw new Error('Required argument "register" is missing');

        const device = loadSvd(svd_file);
        const peripheral = device.peripherals.find(
          (p: SvdPeripheral) => p.name.toLowerCase() === peripheralName.toLowerCase()
        );
        if (!peripheral) {
          throw new Error(
            `Peripheral "${peripheralName}" not found in ${device.name}. ` +
              `Available: ${device.peripherals.map((p) => p.name).join(", ")}`
          );
        }
        const register = peripheral.registers.find(
          (r: SvdRegister) => r.name.toLowerCase() === registerName.toLowerCase()
        );
        if (!register) {
          throw new Error(
            `Register "${registerName}" not found in peripheral "${peripheral.name}". ` +
              `Available: ${peripheral.registers.map((r) => r.name).join(", ")}`
          );
        }

        const absoluteAddress = peripheral.baseAddress + register.addressOffset;
        const result = {
          peripheral: peripheral.name,
          register: register.name,
          description: register.description ?? "",
          addressOffset: `0x${register.addressOffset.toString(16).toUpperCase().padStart(3, "0")}`,
          absoluteAddress: `0x${absoluteAddress.toString(16).toUpperCase().padStart(8, "0")}`,
          size: register.size,
          access: register.access ?? "read-write",
          resetValue:
            register.resetValue !== undefined
              ? `0x${register.resetValue.toString(16).toUpperCase().padStart(8, "0")}`
              : undefined,
          fields: register.fields.map((f: SvdField) => ({
            name: f.name,
            description: f.description ?? "",
            bitOffset: f.bitOffset,
            bitWidth: f.bitWidth,
            bits:
              f.bitWidth === 1
                ? `[${f.bitOffset}]`
                : `[${f.bitOffset + f.bitWidth - 1}:${f.bitOffset}]`,
            mask: `0x${(((1 << f.bitWidth) - 1) << f.bitOffset).toString(16).toUpperCase()}`,
            access: f.access,
          })),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "describe_field": {
        const {
          svd_file,
          peripheral: peripheralName,
          register: registerName,
          field: fieldName,
        } = toolArgs;
        if (!svd_file) throw new Error('Required argument "svd_file" is missing');
        if (!peripheralName) throw new Error('Required argument "peripheral" is missing');
        if (!registerName) throw new Error('Required argument "register" is missing');
        if (!fieldName) throw new Error('Required argument "field" is missing');

        const device = loadSvd(svd_file);
        const peripheral = device.peripherals.find(
          (p: SvdPeripheral) => p.name.toLowerCase() === peripheralName.toLowerCase()
        );
        if (!peripheral) {
          throw new Error(`Peripheral "${peripheralName}" not found in ${device.name}`);
        }
        const register = peripheral.registers.find(
          (r: SvdRegister) => r.name.toLowerCase() === registerName.toLowerCase()
        );
        if (!register) {
          throw new Error(
            `Register "${registerName}" not found in peripheral "${peripheral.name}"`
          );
        }
        const field = register.fields.find(
          (f: SvdField) => f.name.toLowerCase() === fieldName.toLowerCase()
        );
        if (!field) {
          throw new Error(
            `Field "${fieldName}" not found in register "${register.name}". ` +
              `Available: ${register.fields.map((f) => f.name).join(", ")}`
          );
        }

        const result = {
          peripheral: peripheral.name,
          register: register.name,
          field: {
            name: field.name,
            description: field.description ?? "",
            bitOffset: field.bitOffset,
            bitWidth: field.bitWidth,
            bits:
              field.bitWidth === 1
                ? `[${field.bitOffset}]`
                : `[${field.bitOffset + field.bitWidth - 1}:${field.bitOffset}]`,
            mask: `0x${(((1 << field.bitWidth) - 1) << field.bitOffset).toString(16).toUpperCase()}`,
            access: field.access ?? register.access ?? "read-write",
            enumeratedValues: field.enumeratedValues,
          },
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "search_registers": {
        const { svd_file, query } = toolArgs;
        if (!svd_file) throw new Error('Required argument "svd_file" is missing');
        if (!query) throw new Error('Required argument "query" is missing');

        const device = loadSvd(svd_file);
        const lowerQuery = query.toLowerCase();
        const matches: Array<{
          peripheral: string;
          register: string;
          absoluteAddress: string;
          description: string;
        }> = [];

        for (const peripheral of device.peripherals) {
          if (matches.length >= 10) break;
          for (const register of peripheral.registers) {
            const searchText = `${peripheral.name} ${register.name} ${register.description ?? ""}`.toLowerCase();
            if (searchText.includes(lowerQuery)) {
              matches.push({
                peripheral: peripheral.name,
                register: register.name,
                absoluteAddress: `0x${(peripheral.baseAddress + register.addressOffset)
                  .toString(16)
                  .toUpperCase()
                  .padStart(8, "0")}`,
                description: register.description ?? "",
              });
              if (matches.length >= 10) break;
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  count: matches.length,
                  matches,
                  note: matches.length === 0 ? "No registers matched. Try a shorter or different search term." : undefined,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  // Start REST server if REST_PORT is set
  const restPort = process.env["REST_PORT"];
  if (restPort) {
    const port = parseInt(restPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      process.stderr.write(`[mcp-svd] Invalid REST_PORT value: "${restPort}"\n`);
    } else {
      startRestServer(port);
    }
  }

  // Start MCP stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[mcp-svd] MCP server ready (stdio transport)\n");
}

main().catch((err: Error) => {
  process.stderr.write(`[mcp-svd] Fatal error: ${err.message}\n`);
  process.exit(1);
});
