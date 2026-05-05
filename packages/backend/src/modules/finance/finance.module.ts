import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { CostCenterService } from './cost-center.service';
import { CostCenterController } from './cost-center.controller';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { PatientFinanceService } from './patient-finance.service';
import { PatientFinanceController } from './patient-finance.controller';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceAuditController } from './finance-audit.controller';
import { DonorFundService } from './donor-fund.service';
import { DonorFundController } from './donor-fund.controller';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { PettyCashService } from './petty-cash.service';
import { PettyCashController } from './petty-cash.controller';
import { FinanceApprovalService } from './finance-approval.service';
import { TrialBalanceService } from './trial-balance.service';
import { GLReconciliationService } from './gl-reconciliation.service';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { FinanceApprovalChain } from '../../database/entities/finance-approval-chain.entity';
import { FiscalPeriod } from '../../database/entities/fiscal-period.entity';
import {
  CostCenter,
  Budget,
  BudgetLine,
  PatientCreditNote,
  PatientDeposit,
  DepositApplication,
  Waiver,
  FinanceAuditLog,
  DonorFund,
  InterFacilityTransaction,
  BankReconciliation,
  BankReconciliationItem,
  PettyCashFund,
  PettyCashTransaction,
} from '../../database/entities/finance-extended.entity';
import { FacilityBudget } from '../../database/entities/facility-budget.entity';
import { BudgetReservation } from '../../database/entities/budget-reservation.entity';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChartOfAccount,
      JournalEntry,
      JournalEntryLine,
      FiscalPeriod,
      CostCenter,
      Budget,
      BudgetLine,
      PatientCreditNote,
      PatientDeposit,
      DepositApplication,
      Waiver,
      FinanceAuditLog,
      DonorFund,
      InterFacilityTransaction,
      BankReconciliation,
      BankReconciliationItem,
      PettyCashFund,
      PettyCashTransaction,
      FacilityBudget,
      BudgetReservation,
      FinanceApprovalChain,
    ]),
    SystemSettingsModule,
  ],
  controllers: [
    FinanceController,
    CostCenterController,
    BudgetController,
    PatientFinanceController,
    FinanceAuditController,
    DonorFundController,
    BankReconciliationController,
    PettyCashController,
  ],
  providers: [
    FinanceService,
    CostCenterService,
    BudgetService,
    PatientFinanceService,
    FinanceAuditService,
    DonorFundService,
    BankReconciliationService,
    PettyCashService,
    FinanceApprovalService,
    TrialBalanceService,
    GLReconciliationService,
  ],
  exports: [
    FinanceService,
    CostCenterService,
    BudgetService,
    PatientFinanceService,
    FinanceAuditService,
    DonorFundService,
    BankReconciliationService,
    PettyCashService,
    FinanceApprovalService,
    TrialBalanceService,
    GLReconciliationService,
  ],
})
export class FinanceModule {}
