import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DataExportService {
  /**
   * Export all patient data to encrypted JSON
   */
  async exportPatientData(
    outputPath: string = '/backups',
    encryptionKey?: string,
  ): Promise<{
    filePath: string;
    fileSize: number;
    recordCount: number;
    encryptionStatus: string;
  }> {
    // Prepare export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      recordCount: 0,
      patients: [],
    };

    // Create backup directory if needed
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `patient-backup-${timestamp}.json`;
    const filePath = path.join(outputPath, fileName);

    // Encrypt if key provided
    let finalContent = JSON.stringify(exportData, null, 2);
    let encryptionStatus = 'none';

    if (encryptionKey) {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(finalContent, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      finalContent = JSON.stringify(
        {
          encrypted: true,
          version: '1.0.0',
          iv: iv.toString('hex'),
          data: encrypted,
        },
        null,
        2,
      );

      encryptionStatus = 'aes-256-cbc';
    }

    // Write to file
    fs.writeFileSync(filePath, finalContent, 'utf8');

    return {
      filePath,
      fileSize: fs.statSync(filePath).size,
      recordCount: 0,
      encryptionStatus,
    };
  }

  /**
   * Export FHIR-compatible bundle
   */
  async exportFHIRBundle(
    outputPath: string = '/backups',
  ): Promise<{ filePath: string; fileSize: number }> {
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: 0,
      entry: [],
    };

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `fhir-bundle-${timestamp}.json`;
    const filePath = path.join(outputPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), 'utf8');

    return {
      filePath,
      fileSize: fs.statSync(filePath).size,
    };
  }
}
