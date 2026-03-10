# mcp-svd

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes ARM CMSIS SVD hardware register definitions to AI coding assistants. Instead of hallucinating register names, bit positions, and addresses, your AI assistant can query the exact definitions straight from the official SVD file for your microcontroller.

## Quick start

```bash
npm install
npx tsx src/index.ts          # stdio MCP server
REST_PORT=3000 npx tsx src/index.ts  # + REST API on :3000
```

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mcp-svd": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-svd/src/index.ts"]
    }
  }
}
```

Then restart Claude Desktop. You can now ask Claude things like:
> "Look up GPIOA MODER in svd/STM32F411.svd"

## MCP tools

### `list_peripherals`

```json
{ "svd_file": "svd/STM32F411.svd" }
```

Response:
```json
{
  "device": "STM32F411",
  "count": 4,
  "peripherals": [
    { "name": "GPIOA", "baseAddress": "0x40020000", "description": "General-purpose I/Os port A" },
    { "name": "USART1", "baseAddress": "0x40011000", "description": "Universal synchronous asynchronous receiver transmitter 1" }
  ]
}
```

### `lookup_register`

```json
{ "svd_file": "svd/STM32F411.svd", "peripheral": "USART1", "register": "CR1" }
```

Response:
```json
{
  "peripheral": "USART1",
  "register": "CR1",
  "description": "Control register 1",
  "addressOffset": "0x00C",
  "absoluteAddress": "0x4001100C",
  "size": 32,
  "access": "read-write",
  "resetValue": "0x00000000",
  "fields": [
    { "name": "UE",     "bits": "[13]", "mask": "0x2000", "description": "USART enable" },
    { "name": "TE",     "bits": "[3]",  "mask": "0x8",    "description": "Transmitter enable" },
    { "name": "RXNEIE", "bits": "[5]",  "mask": "0x20",   "description": "RXNE interrupt enable" }
  ]
}
```

### `describe_field`

```json
{ "svd_file": "svd/STM32F411.svd", "peripheral": "GPIOA", "register": "MODER", "field": "MODE0" }
```

Response:
```json
{
  "peripheral": "GPIOA",
  "register": "MODER",
  "field": {
    "name": "MODE0",
    "bitOffset": 0,
    "bitWidth": 2,
    "bits": "[1:0]",
    "mask": "0x3",
    "access": "read-write",
    "enumeratedValues": [
      { "name": "Input",     "value": "0", "description": "Input mode" },
      { "name": "Output",    "value": "1", "description": "General purpose output mode" },
      { "name": "Alternate", "value": "2", "description": "Alternate function mode" },
      { "name": "Analog",    "value": "3", "description": "Analog mode" }
    ]
  }
}
```

### `search_registers`

```json
{ "svd_file": "svd/rp2040.svd", "query": "uart" }
```

Returns up to 10 peripheral+register matches (case-insensitive substring).

## REST API

Start with `REST_PORT=3000 npx tsx src/index.ts`, then:

```bash
# List all peripherals
curl "http://localhost:3000/api/v1/peripherals?svd=svd/STM32F411.svd"

# List registers in a peripheral
curl "http://localhost:3000/api/v1/registers/GPIOA?svd=svd/STM32F411.svd"

# Describe a field
curl "http://localhost:3000/api/v1/field/GPIOA/MODER/MODE0?svd=svd/STM32F411.svd"

# Health check
curl "http://localhost:3000/api/v1/health"
```

## Using your own SVD file

1. Download the SVD for your microcontroller from the [cmsis-svd-data repository](https://github.com/cmsis-svd/cmsis-svd-data/tree/main/data) or your chip vendor's website.
2. Place it in `svd/` or any path accessible to the server.
3. Pass the path as `svd_file` in MCP tool calls, or `?svd=` in REST calls.

```json
{ "svd_file": "/path/to/your/device.svd", "peripheral": "SPI0", "register": "CR" }
```

## Bundled SVD files

| File | Device | Source |
|------|--------|--------|
| `svd/STM32F411.svd` | STM32F411 (stub) | Manually created from RM0383 |
| `svd/nRF52840_xxAA.svd` | Nordic nRF52 | cmsis-svd-data |
| `svd/rp2040.svd` | Raspberry Pi RP2040 | cmsis-svd-data |

## License

MIT
