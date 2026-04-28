import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceRecord } from './compliance-record.entity';
import { ComplianceController } from './compliance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceRecord])],
  controllers: [ComplianceController],
})
export class ComplianceModule {}
