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
  //  Глобальное использование ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Убирает поля, которых нет в DTO
      forbidNonWhitelisted: true, // Выдает ошибку, если есть лишние поля
      transform: true, // Автоматически преобразует типы данных
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Knowledge Hub')
    .setDescription(
      'Knowledge hub service for managing articles, categories, and comments',
    )
    .setVersion('1.0')
    .addTag('knowledge-hub')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, documentFactory);

  await app.listen(port);
}
bootstrap();
