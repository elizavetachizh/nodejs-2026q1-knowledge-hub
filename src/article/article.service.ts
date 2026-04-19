import { Injectable, NotFoundException } from '@nestjs/common';
import { Article } from './article.types';
import { ArticleStatus, CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaService } from 'prisma/prisma.service';
import { toArticleDto, toPrismaStatus } from './utils/article.mapper';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}
  async getArticles(
    status?: ArticleStatus,
    categoryId?: string,
    tag?: string,
  ): Promise<Article[]> {
    const raws = await this.prisma.article.findMany({
      where: {
        ...(status ? { status: toPrismaStatus(status) } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(tag ? { tags: { some: { name: tag } } } : {}),
      },
      include: {
        tags: true,
      },
    });
    return raws.map((row) => toArticleDto(row));
  }

  // Used by CommentService, without 404 handling
  async findArticleById(id: string): Promise<Article | null> {
    const row = await this.prisma.article.findUnique({
      where: { id: id },
      include: { tags: true },
    });
    if (!row) return null;
    return toArticleDto(row);
  }

  // Main GET by id
  async getArticle(id: string): Promise<Article> {
    const row = await this.prisma.article.findUnique({
      where: { id },
      include: {
        tags: true,
      },
    });
    if (!row) throw new NotFoundException(`Article with id ${id} not found`);

    return toArticleDto(row);
  }

  async createArticle(createArticleDto: CreateArticleDto): Promise<Article> {
    const row = await this.prisma.article.create({
      data: {
        title: createArticleDto.title,
        content: createArticleDto.content,
        authorId: createArticleDto.authorId,
        categoryId: createArticleDto.categoryId,
        status: toPrismaStatus(createArticleDto.status),
        tags: {
          connectOrCreate: createArticleDto.tags?.map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: {
        tags: true,
      },
    });
    return toArticleDto(row);
  }

  async updateArticle(
    id: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });
    if (!article)
      throw new NotFoundException(`Article with id ${id} not found`);

    const row = await this.prisma.article.update({
      where: { id },
      data: {
        title: updateArticleDto.title,
        content: updateArticleDto.content,
        ...(updateArticleDto.status
          ? { status: toPrismaStatus(updateArticleDto.status) }
          : {}),
        ...(updateArticleDto.authorId !== undefined
          ? { authorId: updateArticleDto.authorId }
          : {}),
        ...(updateArticleDto.categoryId !== undefined
          ? { categoryId: updateArticleDto.categoryId }
          : {}),
        ...(updateArticleDto.tags
          ? {
              tags: {
                set: [],
                connectOrCreate: updateArticleDto.tags?.map((tag) => ({
                  where: { name: tag },
                  create: { name: tag },
                })),
              },
            }
          : {}),
      },
      include: {
        tags: true,
      },
    });
    return toArticleDto(row);
  }
  async clearCategoryId(categoryId: string) {
    return this.prisma.article.updateMany({
      where: { categoryId },
      data: { categoryId: null },
    });
  }

  async clearAuthorId(authorId: string) {
    return this.prisma.article.updateMany({
      where: { authorId },
      data: { authorId: null },
    });
  }

  async deleteArticle(id: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });
    if (!article) {
      throw new NotFoundException(`Article with id ${id} not found`);
    }

    await this.prisma.article.delete({
      where: { id },
    });
  }
}
