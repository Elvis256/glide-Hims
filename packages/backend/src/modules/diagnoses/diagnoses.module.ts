import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { DiagnosesService } from './diagnoses.service';
import { DiagnosesController } from './diagnoses.controller';
import { WHOICDService } from './who-icd.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Diagnosis]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [DiagnosesController],
  providers: [DiagnosesService, WHOICDService],
  exports: [DiagnosesService, WHOICDService],
})
export class DiagnosesModule {}
