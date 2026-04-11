import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../license.service';

/**
 * License Guard - Validates license on every request for on-premise deployments
 * Uses caching to avoid database hits on every request
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly logger = new Logger(LicenseGuard.name);
  private readonly enabled: boolean;
  private readonly licenseKey: string;

  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
  ) {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE');
    this.enabled = deploymentMode === 'on-premise';
    this.licenseKey = this.configService.get<string>('LICENSE_KEY') || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only enforce for on-premise deployments
    if (!this.enabled) {
      return true;
    }

    // Skip license check for health endpoints
    const request = context.switchToHttp().getRequest();
    if (request.url?.includes('/health') || request.url?.includes('/api/license')) {
      return true;
    }

    // Skip if no license configured (development mode)
    if (!this.licenseKey) {
      this.logger.warn('No license key configured - running in development mode');
      return true;
    }

    const result = await this.licenseService.validateLicense(this.licenseKey);

    if (!result.valid) {
      this.logger.error(`License validation failed: ${result.error}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Invalid or expired license',
          error: result.error,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Add license info to request for other guards/handlers
    request.license = result.license;

    return true;
  }
}
