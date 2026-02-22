import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { ICD10Code } from '../../database/entities/icd10-code.entity';
import { DiagnosesService } from './diagnoses.service';
import { DiagnosesController } from './diagnoses.controller';
import { WHOICDService } from './who-icd.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Diagnosis, ICD10Code]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [DiagnosesController],
  providers: [DiagnosesService, WHOICDService],
  exports: [DiagnosesService, WHOICDService],
})
export class DiagnosesModule implements OnModuleInit {
  private readonly logger = new Logger(DiagnosesModule.name);

  constructor(private readonly whoICDService: WHOICDService) {}

  async onModuleInit() {
    try {
      const seeded = await this.whoICDService.seedCommonCodes();
      if (seeded > 0) {
        this.logger.log(`Seeded ${seeded} common ICD-10 codes into local database`);
      }
    } catch (error) {
      this.logger.warn(`Failed to seed ICD-10 codes on startup: ${error.message}`);
    }
  }
}
