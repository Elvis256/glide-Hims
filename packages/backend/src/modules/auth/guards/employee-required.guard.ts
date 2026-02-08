import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../../database/entities/employee.entity';

export const SKIP_EMPLOYEE_CHECK = 'skipEmployeeCheck';

/**
 * Guard that ensures the authenticated user has an associated employee record.
 * Use @SkipEmployeeCheck() decorator to bypass this check on specific routes.
 */
@Injectable()
export class EmployeeRequiredGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this route should skip employee check
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_EMPLOYEE_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      return true; // Let auth guard handle unauthenticated users
    }

    // Check if user has an employee record
    const employee = await this.employeeRepository.findOne({
      where: { userId: user.sub },
    });

    if (!employee) {
      throw new ForbiddenException(
        'Your account is not linked to an employee profile. Please contact HR to complete your profile setup before accessing this module.'
      );
    }

    // Attach employee to request for use in controllers
    request.employee = employee;

    return true;
  }
}
