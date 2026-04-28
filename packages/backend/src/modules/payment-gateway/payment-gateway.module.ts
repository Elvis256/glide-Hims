import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { SandboxGatewayAdapter } from './sandbox.adapter';
import { PesapalAdapter } from './pesapal.adapter';
import { MtnMomoAdapter } from './mtn-momo.adapter';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [ConfigModule, forwardRef(() => BillingModule)],
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService, SandboxGatewayAdapter, PesapalAdapter, MtnMomoAdapter],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
