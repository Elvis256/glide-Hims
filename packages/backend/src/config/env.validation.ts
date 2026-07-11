import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // Authentication
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),

  // Application
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  API_PREFIX: Joi.string().default('api/v1'),

  // Encryption (required in production)
  MFA_ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MFA_SALT: Joi.string().min(16).when('MFA_ENCRYPTION_KEY', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  PII_ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  PII_HASH_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // Licensing
  LICENSE_SECRET_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // External services (optional)
  FLUTTERWAVE_SECRET_KEY: Joi.string().optional(),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),

  // Rate limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // TypeORM
  TYPEORM_SYNCHRONIZE: Joi.string().optional(),
  TYPEORM_MIGRATIONS_RUN: Joi.string().optional(),
}).options({ allowUnknown: true });
