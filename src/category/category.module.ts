import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { ArticleModule } from '../article/article.module';

@Module({
  imports: [ArticleModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
