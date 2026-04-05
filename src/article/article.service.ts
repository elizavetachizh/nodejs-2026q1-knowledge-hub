import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Article } from './article.types';
import { ArticleStatus, CreateArticleDto } from './dto/create-article.dto';
import { randomUUID } from 'node:crypto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CommentService } from '../comment/comment.service';

@Injectable()
export class ArticleService {
  private articles: Article[] = [];
  constructor(
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
  ) {}
  getArticles(
    status?: ArticleStatus,
    categoryId?: string,
    tag?: string,
  ): Article[] {
    return this.articles.filter((article) => {
      if (status && article.status !== status) {
        return false;
      }
      if (categoryId && article.categoryId !== categoryId) {
        return false;
      }
      if (tag && !article.tags.includes(tag)) {
        return false;
      }
      return true;
    });
  }

  // используем для  CommentService, без обработки 404
  findArticleById(id: string): Article | undefined {
    return this.articles.find((article) => article.id === id);
  }

  // основной GET by id
  getArticle(id: string): Article {
    const article = this.findArticleById(id);
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }
    return article;
  }

  createArticle(createArticleDto: CreateArticleDto) {
    const now = new Date().getTime();
    const article: Article = {
      id: randomUUID(),
      title: createArticleDto.title,
      content: createArticleDto.content,
      status: createArticleDto.status ?? ArticleStatus.DRAFT,
      authorId: createArticleDto.authorId,
      categoryId: createArticleDto.categoryId,
      tags: createArticleDto.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.articles.push(article);
    return article;
  }

  updateArticle(id: string, updateArticleDto: UpdateArticleDto) {
    const article = this.articles.find((article) => article.id === id);
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }
    article.title = updateArticleDto.title;
    article.content = updateArticleDto.content;
    article.status = updateArticleDto.status;
    article.authorId = updateArticleDto.authorId;
    article.categoryId = updateArticleDto.categoryId;
    article.tags = updateArticleDto.tags;
    article.updatedAt = new Date().getTime();
    return article;
  }
  clearCategoryId(categoryId: string) {
    const articles = this.articles;
    for (const article of articles) {
      if (article.categoryId === categoryId) {
        article.categoryId = null;
        article.updatedAt = new Date().getTime();
      }
    }
  }

  clearAuthorId(authorId: string) {
    const articles = this.articles;
    for (const article of articles) {
      if (article.authorId === authorId) {
        article.authorId = null;
        article.updatedAt = new Date().getTime();
      }
    }
  }

  deleteArticle(id: string): void {
    const article = this.articles.find((article) => article.id === id);
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }
    this.commentService.deleteCommentByArticleId(id);
    this.articles = this.articles.filter((article) => article.id !== id);
  }
}
