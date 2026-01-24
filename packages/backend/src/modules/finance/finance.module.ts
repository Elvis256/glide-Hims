import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { FiscalPeriod } from '../../database/entities/fiscal-period.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChartOfAccount,
      JournalEntry,
      JournalEntryLine,
      FiscalPeriod,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
