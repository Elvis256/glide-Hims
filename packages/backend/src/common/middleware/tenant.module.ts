import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { Facility } from '../../database/entities/facility.entity';
import { UserRole } from '../../database/entities/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Facility, UserRole])],
  providers: [TenantContextMiddleware],
  exports: [TenantContextMiddleware],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
