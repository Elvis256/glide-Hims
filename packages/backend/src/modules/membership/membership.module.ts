import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { MembershipScheme, PatientMembership } from '../../database/entities/membership.entity';
import { Patient } from '../../database/entities/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipScheme, PatientMembership, Patient])],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
