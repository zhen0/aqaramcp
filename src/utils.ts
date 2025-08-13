import { AqaraResponse } from './types'

// Custom error class for Aqara API errors
export class AqaraError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'AqaraError';
  }
}

// Handle Aqara API responses and errors
export function handleAqaraResponse<T>(response: any): AqaraResponse<T> {
  if (response.data) {
    const { code, message, msgDetails, requestId, result, data } = response.data;
    
    // Aqara API returns code 0 for success
    if (code !== 0) {
      throw new AqaraError(code, message, msgDetails, requestId);
    }
    
    return response.data;
  }
  
  throw new Error('Invalid response format from Aqara API');
}

// Handle axios errors
export function handleAqaraError(error: any): never {
  if (error instanceof AqaraError) {
    throw error;
  }
  
  if (error.response?.data) {
    const { code, message, msgDetails, requestId } = error.response.data;
    throw new AqaraError(
      code || error.response.status,
      message || error.message,
      msgDetails,
      requestId
    );
  }
  
  if (error.code === 'ECONNREFUSED') {
    throw new Error('Unable to connect to Aqara API. Please check your network connection.');
  }
  
  if (error.code === 'ETIMEDOUT') {
    throw new Error('Request to Aqara API timed out. Please try again.');
  }
  
  throw error;
}

// Validate required environment variables
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'AQARA_APP_ID',
    'AQARA_APP_KEY', 
    'AQARA_KEY_ID',
    'AQARA_APP_SECRET'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env file and ensure all Aqara API credentials are provided.'
    );
  }
}

// Format device status for better readability
export function formatDeviceStatus(device: any): string {
  if (!device) return 'No device data available';
  
  const status = {
    name: device.name || 'Unknown Device',
    model: device.model,
    online: device.online ? 'Online' : 'Offline',
    lastUpdate: device.updateTime ? new Date(device.updateTime).toLocaleString() : 'Unknown'
  };
  
  return JSON.stringify(status, null, 2);
}

// Generate a user-friendly error message
export function formatError(error: any): string {
  if (error instanceof AqaraError) {
    return `Aqara API Error (${error.code}): ${error.message}${error.details ? ` - ${error.details}` : ''}`;
  }
  
  return `Error: ${error.message || error.toString()}`;
}

// Helper to parse time strings for history queries
export function parseTimeString(timeStr: string): string {
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    return date.toISOString();
  } catch (error) {
    throw new Error(
      'Invalid time format. Please use ISO 8601 format (e.g., "2024-01-01T00:00:00Z") or standard date strings.'
    );
  }
}