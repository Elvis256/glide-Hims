import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalJwtAuthGuard } from './modules/auth/guards/global-jwt.guard';
import { SecurityAuditInterceptor } from './common/interceptors/security-audit.interceptor';
import { RateLimitGuard } from './modules/auth/guards/rate-limit.guard';

async function bootstrap() {
  // Clear any rate limit entries from previous runs
  RateLimitGuard.clearAllAttempts();
  
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // Global JWT authentication guard - all endpoints require auth by default
  // Use @Public() decorator to mark endpoints as publicly accessible
  app.useGlobalGuards(new GlobalJwtAuthGuard(reflector));

  // Global security audit interceptor - logs sensitive operations
  app.useGlobalInterceptors(new SecurityAuditInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS Configuration
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigins.split(','),
    credentials: true,
  });

  // Swagger Documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
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
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🏥 Glide-HIMS Backend API                          ║
    ║                                                       ║
    ║   Environment: ${configService.get<string>('NODE_ENV', 'development').padEnd(37)}║
    ║   Port:        ${port.toString().padEnd(37)}║
    ║   API:         http://localhost:${port}/${apiPrefix.padEnd(19)}║
    ║   Docs:        http://localhost:${port}/api/docs${' '.repeat(12)}║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();
