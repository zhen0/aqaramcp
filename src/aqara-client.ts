import axios, { AxiosInstance, AxiosRequestHeaders, InternalAxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import Bottleneck from 'bottleneck';
import NodeCache from 'node-cache';
import { AqaraConfig, AqaraResponse, Device, Scene } from './types.js';
import { handleAqaraResponse, handleAqaraError } from './utils.js';

export class AqaraClient {
  private client: AxiosInstance;
  private config: AqaraConfig;
  private limiter: Bottleneck;
  private cache: NodeCache;
  
  constructor(config: AqaraConfig) {
    this.config = config;
    
    // Initialize rate limiter (respect API limits)
    this.limiter = new Bottleneck({
      minTime: 200, // 200ms between requests (max 5 req/sec)
      maxConcurrent: 3
    });
    
    // Initialize cache (10 minute default TTL)
    this.cache = new NodeCache({ 
      stdTTL: 600,
      checkperiod: 120,
      useClones: false
    });
    
    const baseURL = this.getBaseURL(config.region);
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AqaraMCPServer/1.0.0'
      }
    });
    
    // Add request interceptor for signing
    this.client.interceptors.request.use(
      (request) => this.signRequest(request),
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        handleAqaraError(error);
      }
    );
  }
  
  private getBaseURL(region: string): string {
    const domains: Record<string, string> = {
      cn: 'https://open-cn.aqara.com',
      usa: 'https://open-usa.aqara.com',
      eu: 'https://open-ger.aqara.com',
      kr: 'https://open-kr.aqara.com',
      ru: 'https://open-ru.aqara.com',
      sg: 'https://open-sg.aqara.com'
    };
    
    return domains[region] || domains.usa;
  }
  
  private signRequest(request: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    
    // Create sign string - order matters!
    const signParams: string[] = [];
    
    if (this.config.accessToken) {
      signParams.push(`accesstoken=${this.config.accessToken.toLowerCase()}`);
    }
    
    signParams.push(
      `appid=${this.config.appId.toLowerCase()}`,
      `keyid=${this.config.keyId.toLowerCase()}`,
      `nonce=${nonce.toLowerCase()}`,
      `time=${timestamp}`
    );
    
    const signString = signParams.join('&');
    const sign = crypto
      .createHmac('sha256', this.config.appSecret)
      .update(signString)
      .digest('hex');
    
    // Add headers - ensure headers object exists
    if (!request.headers) {
      request.headers = {} as AxiosRequestHeaders;
    }
    
    request.headers['Appid'] = this.config.appId;
    request.headers['Keyid'] = this.config.keyId;
    request.headers['Nonce'] = nonce;
    request.headers['Time'] = timestamp;
    request.headers['Sign'] = sign;
    request.headers['Lang'] = 'en';
    
    if (this.config.accessToken) {
      request.headers['Accesstoken'] = this.config.accessToken;
    }
    
    return request;
  }
  
  private async makeRequest<T>(intent: string, data: any = {}): Promise<AqaraResponse<T>> {
    return this.limiter.schedule(async () => {
      const response = await this.client.post('/v3.0/open/api', {
        intent,
        data
      });
      
      return handleAqaraResponse<T>(response);
    });
  }
  
  async getDeviceList(pageNum = 1, pageSize = 30): Promise<AqaraResponse<Device[]>> {
    const cacheKey = `devices_${pageNum}_${pageSize}`;
    const cached = this.cache.get<AqaraResponse<Device[]>>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await this.makeRequest<Device[]>('query.device.list', {
      pageNum,
      pageSize
    });
    
    // Cache for 5 minutes (devices don't change often)
    this.cache.set(cacheKey, result, 300);
    return result;
  }
  
  async getDeviceStatus(deviceId: string): Promise<AqaraResponse<any>> {
    const cacheKey = `device_status_${deviceId}`;
    const cached = this.cache.get<AqaraResponse<any>>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await this.makeRequest<any>('query.device.info', {
      dids: [deviceId]
    });
    
    // Cache device status for 30 seconds (status changes frequently)
    this.cache.set(cacheKey, result, 30);
    return result;
  }
  
  async controlDevice(
    deviceId: string, 
    resourceId: string, 
    value: any
  ): Promise<AqaraResponse<any>> {
    // Clear cache for this device since we're changing its state
    const cachePattern = `device_status_${deviceId}`;
    this.cache.del(cachePattern);
    
    return this.makeRequest<any>('write.device.resource', {
      did: deviceId,
      resources: [
        {
          subjectId: deviceId,
          resourceId: resourceId,
          value: value
        }
      ]
    });
  }
  
  async getSceneList(pageNum = 1, pageSize = 30): Promise<AqaraResponse<Scene[]>> {
    const cacheKey = `scenes_${pageNum}_${pageSize}`;
    const cached = this.cache.get<AqaraResponse<Scene[]>>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const result = await this.makeRequest<Scene[]>('query.scene.list', {
      pageNum,
      pageSize
    });
    
    // Cache scenes for 10 minutes
    this.cache.set(cacheKey, result, 600);
    return result;
  }
  
  async executeScene(sceneId: string): Promise<AqaraResponse<any>> {
    return this.makeRequest<any>('config.scene.run', {
      sceneId
    });
  }
  
  async getDeviceHistory(
    deviceId: string,
    resourceId: string,
    startTime: string,
    endTime: string,
    pageNum = 1,
    pageSize = 100
  ): Promise<AqaraResponse<any>> {
    return this.makeRequest<any>('fetch.device.history', {
      subjectId: deviceId,
      resourceIds: [resourceId],
      startTime,
      endTime,
      pageNum,
      pageSize
    });
  }
  
  // Additional utility methods
  async getDevicesByType(modelType?: number): Promise<Device[]> {
    const response = await this.getDeviceList(1, 100);
    const devices = response.data || response.result || [];
    
    if (modelType !== undefined) {
      return devices.filter((device: Device) => device.modelType === modelType);
    }
    
    return devices;
  }
  
  async getOnlineDevices(): Promise<Device[]> {
    const devices = await this.getDevicesByType();
    return devices.filter((device: Device) => device.online);
  }
  
  // Clear all cached data
  clearCache(): void {
    this.cache.flushAll();
  }
  
  // Get cache statistics
  getCacheStats(): any {
    return this.cache.getStats();
  }
}