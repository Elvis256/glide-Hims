import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark a controller or route handler as requiring a specific
 * facility module to be enabled for the tenant.
 *
 * Usage:
 *   @RequireModule('emergency')       // single module
 *   @RequireModule('pharmacy', 'pos') // any one of these modules
 *
 * The module codes correspond to sidebar module codes in module-registry.ts.
 * The ModuleGuard reads this metadata and checks the tenant's enabled modules.
 */
export const MODULE_KEY = 'requiredModule';
export const RequireModule = (...modules: string[]) => SetMetadata(MODULE_KEY, modules);
