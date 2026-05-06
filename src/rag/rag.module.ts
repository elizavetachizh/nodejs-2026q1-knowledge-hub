import { forwardRef, Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { ArticleModule } from 'src/article/article.module';
import { AiModule } from 'src/gemini/gemini.module';
import { RagQdrantService } from './rag-qdrant.service';

@Module({
  imports: [forwardRef(() => ArticleModule), forwardRef(() => AiModule)],
  controllers: [RagController],
  providers: [RagService, RagQdrantService],
})
export class RagModule {}
