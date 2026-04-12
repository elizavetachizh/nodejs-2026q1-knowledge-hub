import { forwardRef, Module } from '@nestjs/common';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [forwardRef(() => CommentModule)],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}
