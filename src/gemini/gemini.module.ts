import { forwardRef, Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ArticleModule } from 'src/article/article.module';
import { GeminiController } from './gemini.controller';
import { GeminiHttpService } from './gemini-http.service';
import { GeminiUsageService } from './gemini-usage.service';

@Module({
  providers: [GeminiService, GeminiHttpService, GeminiUsageService],
  exports: [GeminiService, GeminiHttpService],
  controllers: [GeminiController],
  imports: [forwardRef(() => ArticleModule)],
})
export class AiModule {}
