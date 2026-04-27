export class CreateTenantDto {
  name: string;
  slug: string;
  subdomain: string;
  description?: string;
  billing_plan?: 'free' | 'pro' | 'enterprise';
  configuration?: Record<string, any>;
  branding?: Record<string, any>;
}

export class UpdateTenantDto {
  name?: string;
  description?: string;
  configuration?: Record<string, any>;
  branding?: Record<string, any>;
  billing_plan?: 'free' | 'pro' | 'enterprise';
}

export class TenantResponseDto {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: string;
  billing_plan: string;
  user_count: number;
  deployment_count: number;
  created_at: Date;
  updated_at: Date;
}
