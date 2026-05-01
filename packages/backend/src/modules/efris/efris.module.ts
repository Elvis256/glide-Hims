import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EfrisDocument,
  EfrisConfig,
  OutboxEvent,
} from '../../database/entities/pos-compliance.entity';
import { EfrisService } from './efris.service';
import { EfrisController } from './efris.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EfrisDocument, EfrisConfig, OutboxEvent])],
  providers: [EfrisService],
  controllers: [EfrisController],
  exports: [EfrisService],
})
export class EfrisModule {}
