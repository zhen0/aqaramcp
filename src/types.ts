import { z } from 'zod';

export interface AqaraConfig {
  appId: string;
  appKey: string;
  keyId: string;
  appSecret: string;
  region: 'cn' | 'usa' | 'eu' | 'kr' | 'ru' | 'sg';
  accessToken?: string;
}

export interface AqaraResponse<T> {
  code: number;
  requestId: string;
  message: string;
  msgDetails?: string;
  result?: T;
  data?: T;
}

// Resource info schema
export const ResourceInfoSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  access: z.array(z.string()),
  unit: z.string().optional(),
  description: z.string().optional()
});

export type ResourceInfo = z.infer<typeof ResourceInfoSchema>;

// Device schema with enhanced validation
export const DeviceSchema = z.object({
  did: z.string().describe('Device ID'),
  uid: z.string().describe('User ID'),
  name: z.string().describe('Device name'),
  model: z.string().describe('Device model'),
  modelType: z.number().describe('Model type code'),
  online: z.boolean().describe('Online status'),
  firmwareVersion: z.string().describe('Firmware version'),
  createTime: z.number().describe('Creation timestamp'),
  updateTime: z.number().describe('Last update timestamp'),
  resourceInfo: z.array(ResourceInfoSchema).optional().describe('Available resources')
});

export type Device = z.infer<typeof DeviceSchema>;

// Scene schema
export const SceneSchema = z.object({
  sceneId: z.string().describe('Scene ID'),
  name: z.string().describe('Scene name'),
  description: z.string().optional().describe('Scene description'),
  enable: z.boolean().describe('Whether scene is enabled'),
  createTime: z.number().describe('Creation timestamp'),
  updateTime: z.number().describe('Last update timestamp')
});

export type Scene = z.infer<typeof SceneSchema>;

// Device control resource
export const DeviceResourceSchema = z.object({
  subjectId: z.string(),
  resourceId: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()])
});

export type DeviceResource = z.infer<typeof DeviceResourceSchema>;

// History data point
export const HistoryDataPointSchema = z.object({
  time: z.number(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  resourceId: z.string()
});

export type HistoryDataPoint = z.infer<typeof HistoryDataPointSchema>;