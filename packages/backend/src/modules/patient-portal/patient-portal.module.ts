import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Patient } from '../../database/entities/patient.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { Prescription } from '../../database/entities/prescription.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CacheModule } from '../cache/cache.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientPortalService } from './patient-portal.service';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalGuard } from './patient-portal.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Invoice, Appointment, LabSample, Prescription, AuditLog]),
    CacheModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [PatientPortalController],
  providers: [PatientPortalService, PatientPortalGuard],
})
export class PatientPortalModule {}
