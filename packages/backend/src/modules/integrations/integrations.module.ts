import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { OpenFDAService } from './openfda.service';
import { AfricasTalkingService } from './africas-talking.service';
import { LOINCService } from './loinc.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [IntegrationsController],
  providers: [OpenFDAService, AfricasTalkingService, LOINCService],
  exports: [OpenFDAService, AfricasTalkingService, LOINCService],
})
export class IntegrationsModule {}
