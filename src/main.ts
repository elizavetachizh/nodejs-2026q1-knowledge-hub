import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createHttpLoggingMiddleware } from './middleware';
import { AccessGuard } from './common/guards/access.guard';
import 'dotenv/config';
import { AppLoggingService } from './common/logging/app-logging.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { registerProcessErrorHandlers } from './process-error-handlers';

const port = process.env.PORT || 4000;

let nestApp: INestApplication | undefined;

async function bootstrap() {
  const appLogger = new AppLoggingService();
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });
  nestApp = app;

  app.enableShutdownHooks();
  registerProcessErrorHandlers(appLogger, () => nestApp);

  app.useGlobalFilters(new AllExceptionsFilter(appLogger));
  app.use(createHttpLoggingMiddleware(appLogger));
  app.useGlobalGuards(app.get(AccessGuard));
  // Global use of ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Removes fields that are not present in the DTO
      forbidNonWhitelisted: true, // Throws an error when extra fields are provided
      transform: true, // Automatically transforms data types
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Knowledge Hub')
    .setDescription(
      'Knowledge hub service for managing articles, categories, and comments',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste access token as: Bearer <token>',
      },
      'bearer',
    )
    .addTag('knowledge-hub')
    .addTag('Article', 'Operations with articles: create, read, update, delete')
    .addTag('User', 'Operations with users and roles')
    .addTag('Comment', 'Operations with comments for articles')
    .addTag('Category', 'Operations with article categories')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, documentFactory);

  await app.listen(port);
}
bootstrap();
