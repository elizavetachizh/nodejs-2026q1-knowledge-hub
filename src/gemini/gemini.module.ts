import { forwardRef, Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ArticleModule } from 'src/article/article.module';
import { GeminiController } from './gemini.controller';
import { GeminiHttpService } from './gemini-http.service';

@Module({
  providers: [GeminiService, GeminiHttpService],
  exports: [GeminiService],
  controllers: [GeminiController],
  imports: [forwardRef(() => ArticleModule)],
})
export class AiModule {}
