import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorContractsController } from './vendor-contracts.controller';
import { VendorContractsService } from './vendor-contracts.service';
import { VendorContract, ContractAmendment } from '../../database/entities/vendor-contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VendorContract, ContractAmendment])],
  controllers: [VendorContractsController],
  providers: [VendorContractsService],
  exports: [VendorContractsService],
})
export class VendorContractsModule {}
