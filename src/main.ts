import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { loggingMiddleware } from './middleware';
import { AccessGuard } from './common/guards/access.guard';
import 'dotenv/config';

const port = process.env.PORT || 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(loggingMiddleware);
  app.useGlobalGuards(new AccessGuard());
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
