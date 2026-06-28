import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { spawn } from 'child_process';
import * as path from 'path';
import axios from 'axios';

/**
 * On-premise update client. Listens for update-available signals from
 * phone-home and either auto-applies updates or stores them for manual
 * admin action depending on the AUTO_UPDATE env var.
 */
@Injectable()
export class UpdateClientService {
  private readonly logger = new Logger(UpdateClientService.name);
  private readonly enabled: boolean;
  private readonly autoUpdate: boolean;
  private updating = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const mode = this.configService.get<string>('DEPLOYMENT_MODE');
    this.enabled = mode === 'on-premise' || mode === 'hybrid';
    this.autoUpdate = this.configService.get<string>('AUTO_UPDATE') === 'true';
  }

  /**
   * Called by phone-home service when an update is available.
   */
  async handleUpdateAvailable(info: {
    version: string;
    updateUrl: string;
    rolloutId?: string;
  }) {
    if (!this.enabled) return;

    this.logger.log(`Update available: v${info.version} — url: ${info.updateUrl}`);

    // Persist update info so the admin dashboard can show it
    await this.storeAvailableUpdate(info);

    if (this.autoUpdate) {
      this.logger.log('AUTO_UPDATE enabled — starting update process');
      await this.runUpdate(info.updateUrl, info.rolloutId);
    } else {
      this.logger.log(
        'AUTO_UPDATE disabled — update stored for manual trigger. ' +
        'An admin can apply it via POST /api/v1/license/trigger-update',
      );
    }
  }

  /**
   * Manually trigger an update from the latest stored update info.
   */
  async triggerUpdate() {
    if (this.updating) {
      this.logger.warn('Update already in progress');
      return;
    }

    const info = await this.getAvailableUpdate();
    if (!info) {
      this.logger.warn('No pending update available');
      return;
    }

    await this.runUpdate(info.url, info.rolloutId);
  }

  /**
   * Get the currently stored available update info (if any).
   */
  async getAvailableUpdate(): Promise<{ version: string; url: string; rolloutId?: string; detectedAt: string } | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT value FROM system_settings WHERE key = 'available_update' LIMIT 1`,
      );
      if (rows.length && rows[0].value) {
        return typeof rows[0].value === 'string'
          ? JSON.parse(rows[0].value)
          : rows[0].value;
      }
    } catch {
      // table may not exist on fresh installs
    }
    return null;
  }

  private async storeAvailableUpdate(info: {
    version: string;
    updateUrl: string;
    rolloutId?: string;
  }) {
    const value = JSON.stringify({
      version: info.version,
      url: info.updateUrl,
      rolloutId: info.rolloutId,
      detectedAt: new Date().toISOString(),
    });

    try {
      await this.dataSource.query(
        `INSERT INTO system_settings (key, value, description)
         VALUES ('available_update', $1::jsonb, 'Pending software update detected via phone-home')
         ON CONFLICT (key) WHERE tenant_id IS NULL
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [value],
      );
    } catch (err) {
      this.logger.warn(`Failed to store available update: ${(err as Error).message}`);
    }
  }

  private async runUpdate(updateUrl: string, rolloutId?: string) {
    if (this.updating) return;
    this.updating = true;

    const scriptPath = path.resolve(__dirname, '..', '..', '..', '..', 'update-glide.sh');
    const licenseKey = this.configService.get<string>('LICENSE_KEY') || '';
    const platformUrl = this.configService.get<string>('PHONE_HOME_URL') ||
      'https://hmisdemo.itsolutionsuganda.com/api';

    this.logger.log(`Starting update: script=${scriptPath}, url=${updateUrl}`);

    const child = spawn('bash', [scriptPath], {
      env: {
        ...process.env,
        UPDATE_URL: updateUrl,
        LICENSE_KEY: licenseKey,
        ROLLOUT_ID: rolloutId || '',
        PLATFORM_URL: platformUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    child.stdout.on('data', (data) => {
      this.logger.log(`[update] ${data.toString().trim()}`);
    });
    child.stderr.on('data', (data) => {
      this.logger.warn(`[update] ${data.toString().trim()}`);
    });

    child.on('close', async (code) => {
      this.updating = false;
      const status = code === 0 ? 'success' : 'failed';
      this.logger.log(`Update script exited with code ${code} (${status})`);

      // Report result to platform if we have a rolloutId
      if (rolloutId) {
        await this.reportUpdateResult(platformUrl, rolloutId, licenseKey, status, code);
      }

      // Clear stored update on success
      if (code === 0) {
        try {
          await this.dataSource.query(
            `DELETE FROM system_settings WHERE key = 'available_update' AND tenant_id IS NULL`,
          );
        } catch { /* ignore */ }
      }
    });

    // Unref so the parent process doesn't wait for the child
    child.unref();
  }

  private async reportUpdateResult(
    platformUrl: string,
    rolloutId: string,
    licenseKey: string,
    status: string,
    exitCode: number | null,
  ) {
    try {
      const reportUrl = `${platformUrl.replace(/\/api\/?$/, '')}/api/v1/deployments/rollouts/${rolloutId}/report`;
      await axios.post(reportUrl, {
        licenseKey,
        status: status === 'success' ? 'success' : 'failed',
        errorMessage: status === 'failed' ? `Update script exited with code ${exitCode}` : undefined,
      }, { timeout: 15000 });
      this.logger.log(`Reported update result (${status}) to platform`);
    } catch (err) {
      this.logger.warn(`Failed to report update result: ${(err as Error).message}`);
    }
  }
}
