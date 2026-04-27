import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installer } from './installer.entity';
import { InstallerDownload } from './installer-download.entity';
import { License } from '../../database/entities/license.entity';
import { DownloadsService } from './downloads.service';
import { DownloadsController } from './downloads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Installer, InstallerDownload, License])],
  controllers: [DownloadsController],
  providers: [DownloadsService],
  exports: [DownloadsService],
})
export class DownloadsModule {}
