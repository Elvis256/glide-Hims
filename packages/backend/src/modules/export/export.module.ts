import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Item } from '../../database/entities/inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog, Patient, Invoice, Item])],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
