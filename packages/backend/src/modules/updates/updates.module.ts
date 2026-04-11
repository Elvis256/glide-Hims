import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpdatesService } from './updates.service';
import { UpdatesController } from './updates.controller';
import { AppVersion } from '../../database/entities/app-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppVersion])],
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
