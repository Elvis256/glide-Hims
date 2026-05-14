import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyCase } from '../../database/entities/emergency-case.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { VitalsModule } from '../vitals/vitals.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyCase, Encounter, Patient]), VitalsModule],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
