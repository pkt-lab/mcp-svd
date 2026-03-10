# mcp-svd

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes ARM CMSIS SVD hardware register definitions to AI coding assistants. Instead of hallucinating register names, bit positions, and addresses, your AI assistant can query the exact definitions straight from the official SVD file for your microcontroller.

## Install

**From GitHub (no npm needed):**

```bash
npm install github:pkt-lab/mcp-svd
```

Or clone and build manually:

```bash
git clone https://github.com/pkt-lab/mcp-svd
cd mcp-svd
npm install && npm run build
```

## Claude Desktop configuration

### If installed via npm (GitHub):

```json
{
  "mcpServers": {
    "mcp-svd": {
      "command": "node",
      "args": ["./node_modules/mcp-svd/dist/index.js"]
    }
  }
}
```

### If cloned locally:

```json
{
  "mcpServers": {
    "mcp-svd": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-svd/dist/index.js"]
    }
  }
}
```

Config file location:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Restart Claude Desktop after editing.

## MCP tools

### `list_peripherals`

```json
{ "svd_file": "svd/STM32F411.svd" }
```

### `lookup_register`

```json
{ "svd_file": "svd/STM32F411.svd", "peripheral": "USART1", "register": "CR1" }
```

### `describe_field`

```json
{ "svd_file": "svd/STM32F411.svd", "peripheral": "GPIOA", "register": "MODER", "field": "MODE0" }
```

### `search_registers`

```json
{ "svd_file": "svd/rp2040.svd", "query": "uart" }
```

Returns up to 10 peripheral+register matches (case-insensitive substring).

## REST API

```bash
REST_PORT=3000 node dist/index.js

# List peripherals
curl "http://localhost:3000/api/v1/peripherals?svd=svd/STM32F411.svd"

# List registers
curl "http://localhost:3000/api/v1/registers/GPIOA?svd=svd/STM32F411.svd"

# Describe a field
curl "http://localhost:3000/api/v1/field/GPIOA/MODER/MODE0?svd=svd/STM32F411.svd"
```

## Using your own SVD file

Download from [cmsis-svd-data](https://github.com/cmsis-svd/cmsis-svd-data/tree/main/data) or your chip vendor, then pass the path:

```json
{ "svd_file": "/path/to/your/device.svd", "peripheral": "SPI0", "register": "CR" }
```

## Bundled SVD files

| File | Device |
|------|--------|
| `svd/STM32F411.svd` | STM32F411 |
| `svd/nRF52840_xxAA.svd` | Nordic nRF52840 |
| `svd/rp2040.svd` | Raspberry Pi RP2040 |

## License

MIT
