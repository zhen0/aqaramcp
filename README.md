# Aqara MCP Server

A Model Context Protocol (MCP) server for controlling and monitoring Aqara smart home devices. This server provides a standardized interface for AI assistants and applications to interact with your Aqara ecosystem.

## Features

- **Device Management**: List, monitor, and control all your Aqara devices
- **Scene Control**: Execute and manage Aqara scenes and automations
- **Real-time Status**: Get current status and state information from devices
- **Rate Limiting**: Built-in API rate limiting and caching for optimal performance
- **Type Safety**: Full TypeScript implementation with Zod schema validation

## Supported Operations

- List all devices with pagination and filtering
- Get detailed device status and attributes
- Control devices (switches, dimmers, sensors, etc.)
- List and execute scenes/automations
- Monitor device connectivity (online/offline status)
- Clear API cache when needed

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Aqara developer account and API credentials
- Aqara Hub and compatible devices

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd aqaramcp
npm install
```

### 2. Get Aqara API Credentials

1. Visit the [Aqara Developer Portal](https://developer.aqara.com/)
2. Create a developer account and new application
3. Note down your:
   - App ID
   - App Key  
   - Key ID
   - App Secret
   - Region (cn/usa/eu/kr/ru/sg)

### 3. Configure Environment

Create a `.env` file in the project root:

```env
AQARA_APP_ID=your_app_id_here
AQARA_APP_KEY=your_app_key_here
AQARA_KEY_ID=your_key_id_here
AQARA_APP_SECRET=your_app_secret_here
AQARA_REGION=usa
# Optional: Pre-set access token (will be auto-generated if not provided)
AQARA_ACCESS_TOKEN=your_access_token_here
```

**⚠️ Security**: Never commit your `.env` file to version control. Add it to `.gitignore`.

### 4. Build the Project

```bash
npm run build
```

## Usage

### Development Mode

Start the server with live-reload for development:

```bash
npm run dev
```

### Production Mode

Build and start the server:

```bash
npm run build
npm start
```

### Testing and Inspection

Test the MCP interface manually:

```bash
npm test
```

Inspect available tools and schemas:

```bash
npm run inspect
```

## Available Tools

### `list_devices`
List all Aqara devices in your home with their current status.

**Parameters:**
- `pageNum` (optional): Page number for pagination (default: 1)
- `pageSize` (optional): Number of devices per page (default: 30)
- `onlineOnly` (optional): Show only online devices (default: false)

### `get_device_status`
Get detailed status information for a specific device.

**Parameters:**
- `deviceId`: The device ID (did) from `list_devices`

### `control_device`
Control an Aqara device (turn on/off, adjust settings, etc.).

**Parameters:**
- `deviceId`: The device ID (did)
- `resourceId`: The resource/attribute ID (e.g., "4.1.85" for power)
- `value`: Value to set (boolean for switches, number for dimmers, etc.)

### `list_scenes`
List all available Aqara scenes and automations.

**Parameters:**
- `pageNum` (optional): Page number for pagination (default: 1)
- `pageSize` (optional): Number of scenes per page (default: 30) 
- `enabledOnly` (optional): Show only enabled scenes (default: false)

### `execute_scene`
Execute an Aqara scene or automation.

**Parameters:**
- `sceneId`: The scene ID from `list_scenes`

### `get_device_history`
Get historical data for a device over a time period.

**Parameters:**
- `deviceId`: The device ID
- `resourceId`: The resource/attribute ID
- `startTime`: Start time (ISO string or relative like "1h", "30m")
- `endTime` (optional): End time (defaults to now)

### `clear_cache`
Clear the internal API response cache.

**Parameters:** None

## Example Usage

```javascript
// List all devices
const devices = await mcp.callTool('list_devices', {});

// Get status of a specific device
const status = await mcp.callTool('get_device_status', {
  deviceId: 'lumi.1234567890'
});

// Turn on a switch
const result = await mcp.callTool('control_device', {
  deviceId: 'lumi.1234567890',
  resourceId: '4.1.85',
  value: true
});

// Execute a scene
const sceneResult = await mcp.callTool('execute_scene', {
  sceneId: 'scene_123'
});
```

## Development

### Project Structure

```
src/
├── index.ts          # FastMCP server entry point and tool definitions
├── aqara-client.ts   # Aqara API client with auth, caching, rate limiting
├── types.ts          # TypeScript interfaces and Zod schemas
└── utils.ts          # Environment validation, error formatting, helpers
```

### Scripts

- `npm run dev` - Start development server with live reload
- `npm run build` - Compile TypeScript to `build/`
- `npm start` - Run compiled server
- `npm test` - Run FastMCP in dev mode for testing
- `npm run inspect` - Inspect MCP interface metadata
- `npm run clean` - Remove build directory

### Adding New Tools

1. Define the tool in `src/index.ts` using `server.addTool()`
2. Add parameter schemas using Zod with descriptive text
3. Implement the execute function with proper error handling
4. Use `formatError()` for consistent error responses
5. Return JSON-stringified results

### Code Style

- TypeScript with strict mode enabled
- 2-space indentation
- kebab-case for filenames
- camelCase for variables/functions
- PascalCase for classes
- snake_case for tool/resource names

## Troubleshooting

### Environment Validation Errors

If you see environment validation errors on startup:

1. Check that all required environment variables are set in `.env`
2. Verify your Aqara API credentials are correct
3. Ensure your region setting matches your Aqara account region

### API Rate Limiting

The client includes built-in rate limiting (10 requests per second). If you hit limits:

1. Use `clear_cache` tool to reset cached responses
2. Reduce request frequency in your application
3. Consider caching responses in your client application

### Device Control Issues

If device control fails:

1. Verify the device is online using `list_devices` with `onlineOnly: true`
2. Check the correct `resourceId` by examining device status
3. Ensure the value type matches what the device expects

## Contributing

1. Follow the existing code style and conventions
2. Add tests for new functionality (colocate as `*.test.ts`)
3. Update documentation when adding new tools
4. Use Conventional Commits for commit messages
5. Include CLI output/screenshots in pull requests

## License

MIT
