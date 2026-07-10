import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Patient } from '../../database/entities/patient.entity';
import { PatientDocument } from '../../database/entities/patient-document.entity';
import { PatientNote } from '../../database/entities/patient-note.entity';
import { PatientMerge } from '../../database/entities/patient-merge.entity';
import { PatientConsent } from '../../database/entities/patient-consent.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { PatientConsentService } from './patient-consent.service';
import { PatientConsentController } from './patient-consent.controller';
import { AuditModule } from '../../common/interceptors/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientDocument,
      PatientNote,
      PatientMerge,
      PatientConsent,
      AuditLog,
      SystemSetting,
    ]),
    AuditModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/patient-documents',
        filename: (req, file, callback) => {
          const uniqueSuffix = uuidv4();
          const ext = extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowedTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [PatientsController, PatientConsentController],
  providers: [PatientsService, PatientConsentService],
  exports: [PatientsService, PatientConsentService],
})
export class PatientsModule {}
