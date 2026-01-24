import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterDataVersion, MasterDataApprovalRule } from '../../database/entities/master-data-version.entity';
import { MdmService } from './mdm.service';
import { MdmController } from './mdm.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MasterDataVersion, MasterDataApprovalRule])],
  controllers: [MdmController],
  providers: [MdmService],
  exports: [MdmService],
})
export class MdmModule {}
