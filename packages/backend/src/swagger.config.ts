import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export async function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('glide-Hims Deployment Management API')
    .setDescription(
      'Comprehensive API for managing multi-tenant healthcare deployment systems with advanced features including distributed update rollout, real-time health monitoring, multi-channel alerting, intelligent conflict resolution, and deployment orchestration.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'BearerAuth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key for authentication',
      },
      'ApiKeyAuth',
    )
    .addServer('https://hmisdemo.itsolutionsuganda.com/api/v1', 'Production')
    .addServer('http://localhost:3000/api/v1', 'Development')
    .addTag('Deployments', 'Deployment management operations')
    .addTag('Updates', 'Update distribution and rollout management')
    .addTag('Health', 'Health monitoring and metrics')
    .addTag('Alerts', 'Alert management and notifications')
    .addTag('Sync', 'Data synchronization operations')
    .addTag('Conflicts', 'Conflict detection and resolution')
    .setContact(
      'glide-Hims Support',
      'https://glide-hims.example.com/support',
      'support@glide-hims.example.com',
    )
    .setLicense(
      'Apache 2.0',
      'https://www.apache.org/licenses/LICENSE-2.0.html',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger UI at /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      showOperationFilter: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    customCss: `.swagger-ui .topbar { display: none }`,
    customSiteTitle: 'glide-Hims API Documentation',
  });

  return document;
}
