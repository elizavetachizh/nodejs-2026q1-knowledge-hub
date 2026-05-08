import { forwardRef, Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { ArticleModule } from 'src/article/article.module';
import { AiModule } from 'src/gemini/gemini.module';
import { RagQdrantService } from './rag-qdrant.service';
import { RagConversationService } from './rag-conversation.service';

@Module({
  imports: [forwardRef(() => ArticleModule), forwardRef(() => AiModule)],
  controllers: [RagController],
  providers: [RagService, RagQdrantService, RagConversationService],
  exports: [RagService, RagQdrantService, RagConversationService],
})
export class RagModule {}
