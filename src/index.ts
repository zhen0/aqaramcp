import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import dotenv from 'dotenv';
import { AqaraClient } from './aqara-client.js';
import { DeviceSchema, SceneSchema } from './types.js';
import { validateEnvironment, formatError, parseTimeString } from './utils.js';

// Load environment variables
dotenv.config();

// Validate environment before starting
try {
  validateEnvironment();
} catch (error: any) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

// Initialize Aqara client
const aqaraClient = new AqaraClient({
  appId: process.env.AQARA_APP_ID!,
  appKey: process.env.AQARA_APP_KEY!,
  keyId: process.env.AQARA_KEY_ID!,
  appSecret: process.env.AQARA_APP_SECRET!,
  region: (process.env.AQARA_REGION as any) || 'usa',
  accessToken: process.env.AQARA_ACCESS_TOKEN
});

// Create FastMCP server
const server = new FastMCP({
  name: 'aqara-mcp',
  version: '1.0.0',
  instructions: 'MCP server for Aqara home automation control and monitoring'
});

// TOOLS

// Tool: List all devices
server.addTool({
  name: 'list_devices',
  description: 'List all Aqara devices in your home with their current status',
  parameters: z.object({
    pageNum: z.number().optional().default(1).describe('Page number for pagination'),
    pageSize: z.number().optional().default(30).describe('Number of devices per page'),
    onlineOnly: z.boolean().optional().default(false).describe('Show only online devices')
  }),
  execute: async (args) => {
    try {
      if (args.onlineOnly) {
        const devices = await aqaraClient.getOnlineDevices();
        return JSON.stringify({ 
          success: true,
          summary: 'Online devices retrieved successfully',
          count: devices.length,
          devices 
        }, null, 2);
      } else {
        const response = await aqaraClient.getDeviceList(args.pageNum, args.pageSize);
        return JSON.stringify({
          success: true,
          summary: 'Devices retrieved successfully',
          ...response
        }, null, 2);
      }
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// Tool: Get device status
server.addTool({
  name: 'get_device_status',
  description: 'Get detailed status information for a specific Aqara device',
  parameters: z.object({
    deviceId: z.string().describe('The device ID (did) - get this from list_devices')
  }),
  execute: async (args) => {
    try {
      const response = await aqaraClient.getDeviceStatus(args.deviceId);
      return JSON.stringify({
        success: true,
        summary: 'Device status retrieved successfully',
        ...response
      }, null, 2);
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// Tool: Control device
server.addTool({
  name: 'control_device',
  description: 'Control an Aqara device (turn on/off, adjust settings, etc.)',
  parameters: z.object({
    deviceId: z.string().describe('The device ID (did) - get this from list_devices'),
    resourceId: z.string().describe('The resource/attribute ID to control (e.g., "4.1.85" for power)'),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean()
    ]).describe('The value to set (true/false for switches, numbers for dimmers, etc.)')
  }),
  execute: async (args) => {
    try {
      const result = await aqaraClient.controlDevice(
        args.deviceId,
        args.resourceId,
        args.value
      );
      return JSON.stringify({
        success: true,
        summary: 'Device controlled successfully',
        deviceId: args.deviceId,
        resourceId: args.resourceId,
        setValue: args.value,
        result
      }, null, 2);
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// Tool: List scenes
server.addTool({
  name: 'list_scenes',
  description: 'List all available Aqara scenes and automations',
  parameters: z.object({
    pageNum: z.number().optional().default(1).describe('Page number for pagination'),
    pageSize: z.number().optional().default(30).describe('Number of scenes per page'),
    enabledOnly: z.boolean().optional().default(false).describe('Show only enabled scenes')
  }),
  execute: async (args) => {
    try {
      const response = await aqaraClient.getSceneList(args.pageNum, args.pageSize);
      let scenes = response.data || response.result || [];
      
      if (args.enabledOnly) {
        scenes = scenes.filter((scene: any) => scene.enable === true);
      }
      
      return JSON.stringify({
        success: true,
        summary: 'Scenes retrieved successfully',
        count: scenes.length,
        scenes
      }, null, 2);
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// Tool: Execute scene
server.addTool({
  name: 'execute_scene',
  description: 'Execute/trigger an Aqara scene or automation',
  parameters: z.object({
    sceneId: z.string().describe('The scene ID to execute - get this from list_scenes')
  }),
  execute: async (args) => {
    try {
      const result = await aqaraClient.executeScene(args.sceneId);
      return JSON.stringify({
        success: true,
        summary: 'Scene executed successfully',
        sceneId: args.sceneId,
        result
      }, null, 2);
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// Tool: Get device history
server.addTool({
  name: 'get_device_history',
  description: 'Get historical data for a device attribute (sensor readings, state changes, etc.)',
  parameters: z.object({
    deviceId: z.string().describe('The device ID (did)'),
    resourceId: z.string().describe('The resource/attribute ID to get history for'),
    startTime: z.string().describe('Start time in ISO format (e.g., "2024-01-01T00:00:00Z")'),
    endTime: z.string().describe('End time in ISO format (e.g., "2024-01-02T00:00:00Z")'),
    pageNum: z.number().optional().default(1).describe('Page number for pagination'),
    pageSize: z.number().optional().default(100).describe('Number of records per page')
  }),
  execute: async (args) => {
    try {
      // Validate and parse time strings
      const startTime = parseTimeString(args.startTime);
      const endTime = parseTimeString(args.endTime);
      
      const result = await aqaraClient.getDeviceHistory(
        args.deviceId,
        args.resourceId,
        startTime,
        endTime,
        args.pageNum,
        args.pageSize
      );
      
      return JSON.stringify({
        success: true,
        summary: 'Device history retrieved successfully',
        deviceId: args.deviceId,
        resourceId: args.resourceId,
        timeRange: { startTime, endTime },
        result
      }, null, 2);
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// Tool: Clear cache
server.addTool({
  name: 'clear_cache',
  description: 'Clear the internal cache to force fresh data retrieval',
  parameters: z.object({}),
  execute: async () => {
    try {
      aqaraClient.clearCache();
      return JSON.stringify({
        success: true,
        summary: 'Cache cleared successfully'
      });
    } catch (error: any) {
      return formatError(error);
    }
  }
});

// RESOURCES

// Resource: Device list
server.addResource({
  uri: 'aqara://devices',
  name: 'Aqara Devices',
  description: 'Complete list of all Aqara devices in your home',
  mimeType: 'application/json',
  async load() {
    try {
      const response = await aqaraClient.getDeviceList(1, 100);
      return {
        text: JSON.stringify({
          success: true,
          resource: 'Device list resource',
          ...response
        }, null, 2)
      };
    } catch (error: any) {
      return {
        text: JSON.stringify({ error: formatError(error) })
      };
    }
  }
});

// Resource: Scene list
server.addResource({
  uri: 'aqara://scenes',
  name: 'Aqara Scenes',
  description: 'Complete list of all available Aqara scenes and automations',
  mimeType: 'application/json',
  async load() {
    try {
      const response = await aqaraClient.getSceneList(1, 100);
      return {
        text: JSON.stringify({
          success: true,
          resource: 'Scene list resource',
          ...response
        }, null, 2)
      };
    } catch (error: any) {
      return {
        text: JSON.stringify({ error: formatError(error) })
      };
    }
  }
});

// Resource: Online devices
server.addResource({
  uri: 'aqara://devices/online',
  name: 'Online Aqara Devices',
  description: 'List of currently online Aqara devices',
  mimeType: 'application/json',
  async load() {
    try {
      const devices = await aqaraClient.getOnlineDevices();
      return {
        text: JSON.stringify({
          success: true,
          resource: 'Online devices resource',
          count: devices.length,
          devices
        }, null, 2)
      };
    } catch (error: any) {
      return {
        text: JSON.stringify({ error: formatError(error) })
      };
    }
  }
});

// PROMPTS

server.addPrompt({
  name: 'home_status',
  description: 'Get a comprehensive summary of all devices in your Aqara smart home',
  async load() {
    try {
      const response = await aqaraClient.getDeviceList(1, 100);
      const deviceCount = response.data?.length || response.result?.length || 0;
      
      return `Please provide a comprehensive summary of my Aqara smart home with ${deviceCount} devices. 

Use the list_devices tool to get all devices, then for each important device use get_device_status to check their current state. 

Please organize the summary by:
1. **Online vs Offline devices** - How many are currently online?
2. **Device types** - Group similar devices (lights, sensors, switches, etc.)
3. **Current states** - Which lights are on/off, sensor readings, etc.
4. **Any issues** - Devices that might need attention (offline, low battery, etc.)
5. **Quick stats** - Total devices, online percentage, most recent activity

Make it easy to understand at a glance how my smart home is doing.`;
    } catch (error: any) {
      return `Please provide a summary of my Aqara smart home. Use the list_devices tool first to see all available devices, then get their status to provide insights about the current state of my home automation system.`;
    }
  }
});

server.addPrompt({
  name: 'goodnight_routine',
  description: 'Execute a comprehensive goodnight routine for your smart home',
  async load() {
    return `Help me with my goodnight routine. Please:

1. **Check scenes** - Use list_scenes to find any scene related to night/sleep/bedtime and execute it
2. **Light control** - List all devices and identify lights, then:
   - Turn off all main lights
   - Keep any night lights or bedroom accent lighting on if appropriate
3. **Security check** - Check sensors and security devices to ensure they're armed/active
4. **Status summary** - Give me a final summary of what was done

Please be thorough but ask for confirmation before making changes to ensure I'm comfortable with each step.`;
  }
});

server.addPrompt({
  name: 'morning_routine',
  description: 'Execute a morning routine to wake up your smart home',
  async load() {
    return `Help me with my morning routine. Please:

1. **Scene activation** - Look for morning/wake-up scenes and execute appropriate ones
2. **Lighting** - Gradually turn on main area lights, check if any are dimmable for gentle wake-up
3. **Status check** - Check all sensors and devices to see overnight status
4. **Weather/environment** - If you have temperature or environmental sensors, report current conditions
5. **Summary** - Provide a good morning summary of my smart home status

Make it feel like a gentle, organized start to the day!`;
  }
});

server.addPrompt({
  name: 'device_troubleshooting',
  description: 'Help troubleshoot issues with Aqara devices',
  async load() {
    return `Help me troubleshoot issues with my Aqara devices. Please:

1. **System overview** - List all devices and identify any that are offline
2. **Problem identification** - For offline or problematic devices, check:
   - When they were last seen (updateTime)
   - Device model and firmware version
   - Historical connectivity patterns if available
3. **Recommendations** - Provide specific troubleshooting steps for common issues:
   - Connectivity problems
   - Battery-powered device issues
   - Firmware update needs
4. **Health report** - Give an overall system health assessment

Be thorough and provide actionable advice for getting everything working optimally.`;
  }
});

// Error handling for server startup
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Aqara MCP Server...');
  aqaraClient.clearCache();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Aqara MCP Server...');
  aqaraClient.clearCache();
  process.exit(0);
});

// Start the server
console.log('🚀 Starting Aqara MCP Server...');
console.log(`📡 Region: ${process.env.AQARA_REGION || 'usa'}`);
console.log(`🔐 App ID: ${process.env.AQARA_APP_ID?.substring(0, 8)}...`);

server.start({
  transportType: 'stdio'
}).then(() => {
  console.log('✅ Aqara MCP Server started successfully');
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});