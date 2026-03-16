import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextInterceptor } from './tenant-context.middleware';
import { Facility } from '../../database/entities/facility.entity';
import { UserRole } from '../../database/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Facility, UserRole])],
  providers: [
    TenantContextInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TenantContextInterceptor],
})
export class TenantModule {}
