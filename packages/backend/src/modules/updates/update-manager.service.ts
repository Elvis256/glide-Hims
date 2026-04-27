import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createReadStream, createWriteStream } from 'fs';

@Injectable()
export class UpdateManagerService {
  private readonly UPDATES_DIR = process.env.UPDATES_PATH || '/updates';

  constructor() {
    this.ensureUpdatesDirExists();
  }

  private ensureUpdatesDirExists() {
    if (!fs.existsSync(this.UPDATES_DIR)) {
      fs.mkdirSync(this.UPDATES_DIR, { recursive: true });
    }
  }

  /**
   * Create delta update file (compressed diff)
   */
  async createDeltaUpdate(
    fromVersion: string,
    toVersion: string,
    changedFiles: { path: string; content: string }[],
  ): Promise<{
    updateFile: string;
    checksum: string;
    size: number;
    version: string;
  }> {
    const updateData = {
      fromVersion,
      toVersion,
      createdAt: new Date().toISOString(),
      files: changedFiles.map((f) => ({
        path: f.path,
        hash: crypto.createHash('sha256').update(f.content).digest('hex'),
        size: f.content.length,
      })),
      fileCount: changedFiles.length,
    };

    const updateMetadata = JSON.stringify(updateData, null, 2);
    const checksum = crypto.createHash('sha256').update(updateMetadata).digest('hex');

    const updateFileName = `glide-${fromVersion}-to-${toVersion}-${checksum.slice(0, 8)}.update`;
    const updateFilePath = path.join(this.UPDATES_DIR, updateFileName);

    // Create gzipped update file
    const content = JSON.stringify(updateData);
    const gzip = zlib.createGzip();
    const writeStream = createWriteStream(updateFilePath);

    await new Promise((resolve, reject) => {
      const buffer = Buffer.from(content);
      gzip.pipe(writeStream);
      gzip.write(buffer);
      gzip.end();
      writeStream.on('finish', () => resolve(undefined));
      writeStream.on('error', reject);
    });

    const stats = fs.statSync(updateFilePath);

    return {
      updateFile: updateFileName,
      checksum,
      size: stats.size,
      version: toVersion,
    };
  }

  /**
   * Verify update file integrity
   */
  async verifyUpdateFile(filePath: string): Promise<{
    valid: boolean;
    fromVersion?: string;
    toVersion?: string;
    fileCount?: number;
    message: string;
  }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { valid: false, message: 'Update file not found' };
      }

      // Decompress and parse
      const gunzip = zlib.createGunzip();
      const readStream = createReadStream(filePath);
      let decompressed = '';

      return new Promise((resolve) => {
        readStream
          .pipe(gunzip)
          .on('data', (chunk) => {
            decompressed += chunk.toString();
          })
          .on('end', () => {
            try {
              const updateData = JSON.parse(decompressed);
              resolve({
                valid: true,
                fromVersion: updateData.fromVersion,
                toVersion: updateData.toVersion,
                fileCount: updateData.fileCount,
                message: 'Update file is valid',
              });
            } catch {
              resolve({ valid: false, message: 'Failed to parse update file' });
            }
          })
          .on('error', () => {
            resolve({ valid: false, message: 'Failed to decompress update file' });
          });
      });
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }

  /**
   * List available updates
   */
  async listAvailableUpdates(): Promise<
    Array<{
      fileName: string;
      fromVersion: string;
      toVersion: string;
      size: number;
      createdAt: string;
    }>
  > {
    const files = fs.readdirSync(this.UPDATES_DIR).filter((f) => f.endsWith('.update'));

    return files.map((fileName) => {
      const filePath = path.join(this.UPDATES_DIR, fileName);
      const stats = fs.statSync(filePath);
      const match = fileName.match(/glide-(.+)-to-(.+)-(.+)\.update/);

      return {
        fileName,
        fromVersion: match ? match[1] : 'unknown',
        toVersion: match ? match[2] : 'unknown',
        size: stats.size,
        createdAt: new Date(stats.mtimeMs).toISOString(),
      };
    });
  }

  /**
   * Check for updates (compares with current version)
   */
  async checkForUpdates(currentVersion: string): Promise<{
    updateAvailable: boolean;
    latestVersion?: string;
    updateFile?: string;
    message: string;
  }> {
    const updates = await this.listAvailableUpdates();

    if (updates.length === 0) {
      return {
        updateAvailable: false,
        message: 'No updates available',
      };
    }

    // Find updates that can be applied from current version
    const applicableUpdates = updates.filter(
      (u) => u.fromVersion === currentVersion || u.fromVersion === 'any',
    );

    if (applicableUpdates.length === 0) {
      return {
        updateAvailable: false,
        message: `No updates available for version ${currentVersion}`,
      };
    }

    // Return the latest applicable update
    const latestUpdate = applicableUpdates[applicableUpdates.length - 1];
    return {
      updateAvailable: true,
      latestVersion: latestUpdate.toVersion,
      updateFile: latestUpdate.fileName,
      message: `Update available: ${currentVersion} → ${latestUpdate.toVersion}`,
    };
  }

  /**
   * Mark update as applied
   */
  async markUpdateApplied(
    updateFile: string,
    appliedAt: Date = new Date(),
  ): Promise<{ fileName: string; appliedAt: string }> {
    const markerFile = path.join(this.UPDATES_DIR, `.${updateFile}.applied`);
    fs.writeFileSync(
      markerFile,
      JSON.stringify({ appliedAt: appliedAt.toISOString() }, null, 2),
    );

    return {
      fileName: updateFile,
      appliedAt: appliedAt.toISOString(),
    };
  }

  /**
   * Get update history
   */
  async getUpdateHistory(): Promise<
    Array<{
      updateFile: string;
      appliedAt: string;
      status: string;
    }>
  > {
    const updates = await this.listAvailableUpdates();
    return updates.map((update) => {
      const markerFile = path.join(this.UPDATES_DIR, `.${update.fileName}.applied`);
      const applied = fs.existsSync(markerFile);

      let appliedAt = '';
      if (applied) {
        const data = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
        appliedAt = data.appliedAt;
      }

      return {
        updateFile: update.fileName,
        appliedAt,
        status: applied ? 'applied' : 'pending',
      };
    });
  }
}
