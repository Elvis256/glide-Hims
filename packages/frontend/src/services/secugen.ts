/**
 * SecuGen Fingerprint Scanner Service
 * 
 * This service communicates with the fingerprint service running locally.
 * 
 * On Windows: Uses SecuGen WebAPI at https://localhost:8443
 * On Linux: Uses our custom fingerprint-service at http://localhost:8444
 * 
 * The service auto-detects which backend is available.
 */

// Try Linux service first (more likely in this deployment), then Windows WebAPI
const LINUX_API_URL = 'http://localhost:8444';
const WINDOWS_API_URL = 'https://localhost:8443';

let SECUGEN_API_URL = LINUX_API_URL;

export type FingerIndex = 
  | 'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_little'
  | 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_little';

export interface DeviceInfo {
  connected: boolean;
  deviceName?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  imageWidth?: number;
  imageHeight?: number;
  error?: string;
}

export interface CaptureResult {
  success: boolean;
  imageData?: string; // Base64 encoded fingerprint image
  templateData?: string; // Base64 encoded fingerprint template (for matching)
  quality?: number; // Quality score 0-100
  error?: string;
}

export interface MatchResult {
  matched: boolean;
  score?: number;
  error?: string;
}

class SecuGenService {
  private apiUrl: string;
  private isLinuxService: boolean = false;
  private initialized: boolean = false;

  constructor(apiUrl: string = SECUGEN_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Initialize and detect which backend is available
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try Linux service first
    try {
      const response = await fetch(`${LINUX_API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        this.apiUrl = LINUX_API_URL;
        this.isLinuxService = true;
        this.initialized = true;
        console.log('Using Linux fingerprint service');
        return;
      }
    } catch {
      // Linux service not available
    }

    // Try Windows WebAPI
    try {
      const response = await fetch(`${WINDOWS_API_URL}/api/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        this.apiUrl = WINDOWS_API_URL;
        this.isLinuxService = false;
        this.initialized = true;
        console.log('Using Windows SecuGen WebAPI');
        return;
      }
    } catch {
      // Windows service not available
    }

    this.initialized = true;
    console.warn('No fingerprint service available');
  }

  /**
   * Check if fingerprint service is available
   */
  async isAvailable(): Promise<boolean> {
    await this.initialize();
    
    try {
      const endpoint = this.isLinuxService ? '/health' : '/api/ping';
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    await this.initialize();
    
    try {
      if (this.isLinuxService) {
        // Linux service endpoint
        const response = await fetch(`${this.apiUrl}/status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          return { connected: false, error: 'Failed to get device info' };
        }

        const data = await response.json();
        return {
          connected: data.connected,
          deviceName: data.mock_mode ? 'Mock Scanner (Testing)' : 'SecuGen Scanner',
          error: data.connected ? undefined : 'Device not connected',
        };
      } else {
        // Windows SecuGen WebAPI endpoint
        const response = await fetch(`${this.apiUrl}/api/DeviceInfo`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          return { connected: false, error: 'Failed to get device info' };
        }

        const data = await response.json();
        
        if (data.ErrorCode === 0) {
          return {
            connected: true,
            deviceName: data.DeviceName || 'SecuGen Scanner',
            serialNumber: data.SerialNumber,
            firmwareVersion: data.FirmwareVersion,
            imageWidth: data.ImageWidth,
            imageHeight: data.ImageHeight,
          };
        }

        return {
          connected: false,
          error: data.ErrorMessage || 'Device not connected',
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: 'Fingerprint service not available. Please ensure it is installed and running.',
      };
    }
  }

  /**
   * Capture a fingerprint
   * @param timeout - Capture timeout in seconds (default: 10)
   * @param quality - Minimum quality threshold (default: 50)
   */
  async capture(timeout: number = 10, quality: number = 50): Promise<CaptureResult> {
    await this.initialize();
    
    try {
      if (this.isLinuxService) {
        // Linux service endpoint
        const response = await fetch(`${this.apiUrl}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeout: timeout * 1000,
            quality: quality,
          }),
        });

        if (!response.ok) {
          return { success: false, error: 'Capture failed' };
        }

        const data = await response.json();

        if (data.success) {
          return {
            success: true,
            templateData: data.template,
            quality: data.quality,
          };
        }

        return {
          success: false,
          error: data.error || 'Capture failed',
        };
      } else {
        // Windows SecuGen WebAPI endpoint
        const response = await fetch(`${this.apiUrl}/api/Capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Timeout: timeout * 1000,
            Quality: quality,
            TemplateFormat: 'ISO',
          }),
        });

        if (!response.ok) {
          return { success: false, error: 'Capture failed' };
        }

        const data = await response.json();

        if (data.ErrorCode === 0) {
          return {
            success: true,
            imageData: data.ImageData,
            templateData: data.TemplateData || data.Template,
            quality: data.Quality || data.ImageQuality,
          };
        }

        const errorMessages: Record<number, string> = {
          1: 'Timeout - no finger detected',
          2: 'Device busy',
          3: 'Device not found',
          4: 'Invalid quality - please press finger firmly',
          5: 'Capture cancelled',
        };

        return {
          success: false,
          error: errorMessages[data.ErrorCode] || data.ErrorMessage || 'Capture failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to communicate with scanner. Please check connection.',
      };
    }
  }

  /**
   * Match two fingerprint templates
   * @param template1 - First template (Base64)
   * @param template2 - Second template (Base64)
   * @param threshold - Match threshold (default: 50)
   */
  async match(template1: string, template2: string, threshold: number = 50): Promise<MatchResult> {
    await this.initialize();
    
    try {
      if (this.isLinuxService) {
        // Linux service endpoint
        const response = await fetch(`${this.apiUrl}/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template1,
            template2,
            securityLevel: Math.min(Math.floor(threshold / 10), 9),
          }),
        });

        if (!response.ok) {
          return { matched: false, error: 'Match request failed' };
        }

        const data = await response.json();
        return {
          matched: data.matched,
          score: data.matched ? 100 : 0,
        };
      } else {
        // Windows SecuGen WebAPI endpoint
        const response = await fetch(`${this.apiUrl}/api/Match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Template1: template1,
            Template2: template2,
            TemplateFormat: 'ISO',
          }),
        });

        if (!response.ok) {
          return { matched: false, error: 'Match request failed' };
        }

        const data = await response.json();

        if (data.ErrorCode === 0) {
          const score = data.MatchingScore || data.Score || 0;
          return {
            matched: score >= threshold,
            score,
          };
        }

        return {
          matched: false,
          error: data.ErrorMessage || 'Match failed',
        };
      }
    } catch (error) {
      return {
        matched: false,
        error: 'Failed to perform match. Please try again.',
      };
    }
  }

  /**
   * Match a captured template against multiple stored templates
   * Returns the best match if any
   */
  async matchAgainstMultiple(
    capturedTemplate: string,
    storedTemplates: { fingerIndex: FingerIndex; templateData: string }[],
    threshold: number = 50
  ): Promise<{ matched: boolean; fingerIndex?: FingerIndex; score?: number; error?: string }> {
    let bestMatch = { matched: false, fingerIndex: undefined as FingerIndex | undefined, score: 0 };

    for (const stored of storedTemplates) {
      const result = await this.match(capturedTemplate, stored.templateData, threshold);
      
      if (result.matched && (result.score || 0) > bestMatch.score) {
        bestMatch = {
          matched: true,
          fingerIndex: stored.fingerIndex,
          score: result.score || 0,
        };
      }
    }

    if (bestMatch.matched) {
      return bestMatch;
    }

    return { matched: false, error: 'Fingerprint does not match any registered finger' };
  }
}

// Export singleton instance
export const secugenService = new SecuGenService();

// Also export class for testing
export { SecuGenService };
