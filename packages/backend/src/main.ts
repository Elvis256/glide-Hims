import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  BadRequestException,
  Logger,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalJwtAuthGuard } from './modules/auth/guards/global-jwt.guard';
import { SecurityAuditInterceptor } from './common/interceptors/security-audit.interceptor';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // HTTPS configuration
  const sslKeyPath = join(__dirname, '..', 'ssl', 'server.key');
  const sslCertPath = join(__dirname, '..', 'ssl', 'server.crt');
  const useHttps = existsSync(sslKeyPath) && existsSync(sslCertPath);

  const httpsOptions = useHttps
    ? {
        key: readFileSync(sslKeyPath),
        cert: readFileSync(sslCertPath),
      }
    : undefined;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  // Trust the first proxy (nginx) so Express uses X-Forwarded-For correctly
  // for rate limiting, without allowing arbitrary header spoofing.
  app.set('trust proxy', 1);

  const configService = app.get(ConfigService);

  // Validate critical environment variables
  const requiredEnvVars = [
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];
  for (const envVar of requiredEnvVars) {
    if (!configService.get(envVar)) {
      logger.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Warn if MFA encryption key is missing — MFA features will fail at runtime
  if (!configService.get('MFA_ENCRYPTION_KEY')) {
    logger.warn(
      'MFA_ENCRYPTION_KEY is not set — MFA enrollment/verification will fail. Set this variable to enable MFA support.',
    );
  }
  const jwtSecret = configService.get<string>('JWT_SECRET', '');
  const isProduction = configService.get('NODE_ENV') === 'production';
  if (isProduction) {
    if (jwtSecret.length < 32) {
      logger.error('JWT_SECRET must be at least 32 characters in production');
      process.exit(1);
    }
    if (jwtSecret.includes('dev') || jwtSecret.includes('test') || jwtSecret.includes('xxx')) {
      logger.error(
        'JWT_SECRET appears to be a development value — use a cryptographically random secret in production',
      );
      process.exit(1);
    }
    if (!configService.get('MFA_ENCRYPTION_KEY')) {
      logger.warn('MFA_ENCRYPTION_KEY not set — MFA features will be unavailable');
    }
    if (!configService.get('REDIS_PASSWORD')) {
      logger.warn('REDIS_PASSWORD not set — Redis is unprotected');
    }
  }

  // Security: Helmet HTTP headers
  const isDev = configService.get('NODE_ENV') !== 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isDev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          },
      hsts: useHttps ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  // Correlation ID middleware (request tracing)
  app.use(correlationIdMiddleware);

  // Cookie parser for httpOnly JWT cookies
  app.use(cookieParser());

  // Increase body size limit for logo uploads (base64 encoded images)
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' } as any);
  const reflector = app.get(Reflector);

  // Global JWT authentication guard - all endpoints require auth by default
  app.useGlobalGuards(new GlobalJwtAuthGuard(reflector));

  // Global security audit interceptor - logs sensitive operations
  app.useGlobalInterceptors(new SecurityAuditInterceptor());

  // Global tenant interceptor - sets tenantId from JWT on every request
  app.useGlobalInterceptors(new TenantInterceptor(reflector));

  // Global response transform interceptor - standardizes API response envelopes
  app.useGlobalInterceptors(new ResponseTransformInterceptor(reflector));

  // ClassSerializerInterceptor - Strips @Exclude() fields (passwordHash, mfaSecret, etc.) from responses
  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((err) => ({
          field: err.property,
          errors: Object.values(err.constraints || {}),
        }));
        logger.warn(`Validation failed: ${JSON.stringify(messages)}`);
        return new BadRequestException({ message: 'Validation failed', details: messages });
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // API Prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS Configuration
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Facility-Id',
      'X-Tenant-Id',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  // Swagger Documentation — only available in development
  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('Glide-HIMS API')
      .setDescription('Enterprise HMIS/ERP for Uganda Healthcare - API Documentation')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addTag('authentication', 'Authentication & Authorization')
      .addTag('users', 'User Management')
      .addTag('facilities', 'Facility Management')
      .addTag('patients', 'Patient Master Data')
      .addTag('providers', 'Provider Master Data')
      .addTag('tenants', 'Tenant Management')
      .addTag('roles', 'Role & Permission Management')
      .addTag('health', 'Health Checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  const protocol = useHttps ? 'https' : 'http';
  logger.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🏥 Glide-HIMS Backend API                          ║
    ║                                                       ║
    ║   Environment: ${configService.get<string>('NODE_ENV', 'development').padEnd(37)}║
    ║   Port:        ${port.toString().padEnd(37)}║
    ║   HTTPS:       ${(useHttps ? 'Enabled' : 'Disabled').padEnd(37)}║
    ║   Helmet:      ${'Enabled'.padEnd(37)}║
    ║   API:         ${protocol}://localhost:${port}/${apiPrefix.padEnd(19 - protocol.length)}║
    ║   Docs:        ${protocol}://localhost:${port}/api/docs${' '.repeat(12 - protocol.length)}║
    ║   Health:      ${protocol}://localhost:${port}/${apiPrefix}/health${' '.repeat(5 - protocol.length)}║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();
