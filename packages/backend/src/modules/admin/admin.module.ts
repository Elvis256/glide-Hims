import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities';
import { TenantService } from '../tenants/services';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [AdminService, TenantService],
  controllers: [AdminController],
  exports: [AdminService, TenantService],
})
export class AdminModule {}
