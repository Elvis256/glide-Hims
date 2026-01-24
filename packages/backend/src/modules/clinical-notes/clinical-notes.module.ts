import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalNotesController } from './clinical-notes.controller';
import { ClinicalNotesService } from './clinical-notes.service';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { Encounter } from '../../database/entities/encounter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicalNote, Encounter])],
  controllers: [ClinicalNotesController],
  providers: [ClinicalNotesService],
  exports: [ClinicalNotesService],
})
export class ClinicalNotesModule {}
