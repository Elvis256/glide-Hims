import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosComplianceController } from './pos-compliance.controller';
import { PosComplianceService } from './pos-compliance.service';
import { PosShiftGuardService } from './services/pos-shift-guard.service';
import { PosRetailController } from './pos-retail.controller';
import { PosRetailService } from './pos-retail.service';
import { PosMomoService } from './pos-momo.service';
import { PosMobileMoneyTransaction } from '../../database/entities/pos-resilience.entity';
import { PaymentGatewayModule } from '../payment-gateway/payment-gateway.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import {
  PosRegister,
  PosShift,
  PosPaymentSplit,
  WholesaleCustomer,
  PricingTier,
  Delivery,
} from '../../database/entities/pos.entity';
import { PosCashDrawerEvent, PosZReport } from '../../database/entities/pos-compliance.entity';
import {
  PharmacyReturn,
  PharmacyReturnItem,
  HeldSale,
  DiscountApplication,
  PosQuickKey,
  RetailCustomer,
  ReceiptReprint,
} from '../../database/entities/pos-retail.entity';
import { PharmacySale, PharmacySaleItem } from '../../database/entities/pharmacy-sale.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { EfrisModule } from '../efris/efris.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { FinanceModule } from '../finance/finance.module';
import { PosRetailEventListener } from './pos-retail.listener';

@Module({
  imports: [
    EfrisModule,
    SystemSettingsModule,
    FinanceModule,
    PaymentGatewayModule,
    forwardRef(() => PharmacyModule),
    TypeOrmModule.forFeature([
      PosMobileMoneyTransaction,
      PosRegister,
      PosShift,
      PosPaymentSplit,
      WholesaleCustomer,
      PricingTier,
      Delivery,
      PosCashDrawerEvent,
      PosZReport,
      PharmacyReturn,
      PharmacyReturnItem,
      HeldSale,
      DiscountApplication,
      PosQuickKey,
      RetailCustomer,
      ReceiptReprint,
      PharmacySale,
      PharmacySaleItem,
      Item,
      StockBalance,
      StockLedger,
    ]),
  ],
  controllers: [PosController, PosComplianceController, PosRetailController],
  providers: [
    PosService,
    PosComplianceService,
    PosShiftGuardService,
    PosRetailService,
    PosRetailEventListener,
    PosMomoService,
  ],
  exports: [
    PosService,
    PosComplianceService,
    PosShiftGuardService,
    PosRetailService,
    PosMomoService,
  ],
})
export class PosModule {}
