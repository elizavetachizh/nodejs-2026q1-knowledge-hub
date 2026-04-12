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
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ArticleService {
  private prisma: PrismaService;
  constructor(
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
  ) {}
  async getArticles(
    status?: ArticleStatus,
    categoryId?: string,
    tag?: string,
  ): Promise<Article[]> {
    return await this.prisma.article.findMany({
      where: {
        status,
        categoryId,
        tags: {
          some: {
            name: tag,
          },
        },
      },
    });
  }

  // Used by CommentService, without 404 handling
  async findArticleById(id: string): Promise<Article> {
    return  await this.prisma.article.findUnique({
      where: { id },
    });
  }

  // Main GET by id
  async getArticle(id: string): Promise<Article> {
    return await this.prisma.article.findUnique({
      where: { id },
    });
  }

  async createArticle(createArticleDto: CreateArticleDto): Promise<Article> {
    const now = new Date().getTime();
    return await this.prisma.article.create({
      data: createArticleDto,
    });
  }

  async updateArticle(id: string, updateArticleDto: UpdateArticleDto): Promise<Article> {
    const article = this.articles.find((article) => article.id === id);
    return await this.prisma.article.update({
      where: { id },
      data: updateArticleDto,
    });
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

  async deleteArticle(id: string): Promise<void> {
    const article = this.articles.find((article) => article.id === id);
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }
    this.commentService.deleteCommentByArticleId(id);
    this.articles = this.articles.filter((article) => article.id !== id);
  }
}
