import { SetMetadata } from '@nestjs/common';
import { SKIP_EMPLOYEE_CHECK } from '../guards/employee-required.guard';

/**
 * Decorator to skip employee check on specific routes.
 * Use this on routes that should be accessible even without an employee profile
 * (e.g., login, profile setup, initial user creation).
 */
export const SkipEmployeeCheck = () => SetMetadata(SKIP_EMPLOYEE_CHECK, true);
