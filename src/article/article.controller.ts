import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Query,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { ArticleService } from './article.service';
import { ArticleStatus, CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PageDto } from 'src/common/dto/page-query.dto';
import { sortData } from 'src/common/utils/sort';
import { Article } from './article.types';

@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ArticleStatus,
    description: 'Filter by article status',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category id (UUID)',
  })
  @ApiQuery({
    name: 'tag',
    required: false,
    type: String,
    description: 'Filter by tag name',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort by field',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    description: 'Sort order',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number',
  })
  getArticles(
    @Query('status') status?: ArticleStatus,
    @Query('categoryId') categoryId?: string,
    @Query('tag') tag?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query() rawQuery?: Record<string, unknown>,
  ) {
    const articles: Article[] = this.articleService.getArticles(
      status,
      categoryId,
      tag,
    );
    const hasSorting =
      typeof rawQuery?.sortBy === 'string' &&
      (rawQuery.sortBy as string).length > 0;
    const sortedArticles = hasSorting
      ? sortData<Article>(articles, sortBy, order, [
          'title',
          'status',
          'categoryId',
          'createdAt',
          'updatedAt',
        ])
      : articles;
    const hasPagination =
      rawQuery?.page !== undefined || rawQuery?.limit !== undefined;
    if (hasPagination) {
      const safePage = page ?? 1;
      const safeLimit = limit ?? 10;
      const pagedArticles = sortedArticles.slice(
        (safePage - 1) * safeLimit,
        safePage * safeLimit,
      );
      return new PageDto(
        pagedArticles,
        sortedArticles.length,
        safePage,
        safeLimit,
      );
    }
    return sortedArticles;
  }

  @Get(':id')
  getArticle(@Param('id', ParseUUIDPipe) id: string) {
    return this.articleService.getArticle(id);
  }

  @Post()
  createArticle(@Body() createArticleDto: CreateArticleDto) {
    return this.articleService.createArticle(createArticleDto);
  }

  @Put(':id')
  updateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.articleService.updateArticle(id, updateArticleDto);
  }

  @Delete(':id')
  @HttpCode(204) // Or use @HttpCode(HttpStatus.NO_CONTENT)
  deleteArticle(@Param('id', ParseUUIDPipe) id: string): void {
    this.articleService.deleteArticle(id);
  }
}
