import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationsController } from './integrations.controller';
import { DHIS2Controller } from './dhis2.controller';
import { OpenFDAService } from './openfda.service';
import { AfricasTalkingService } from './africas-talking.service';
import { LOINCService } from './loinc.service';
import { DHIS2Service } from './dhis2.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    AnalyticsModule,
    SystemSettingsModule,
  ],
  controllers: [IntegrationsController, DHIS2Controller],
  providers: [OpenFDAService, AfricasTalkingService, LOINCService, DHIS2Service],
  exports: [OpenFDAService, AfricasTalkingService, LOINCService, DHIS2Service],
})
export class IntegrationsModule {}
