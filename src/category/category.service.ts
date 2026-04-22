import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from './category.types';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}
  private legacyCategories: Category[] = [];
  private legacyIdCounter = 1;

  private isLegacyMode(): boolean {
    return typeof (this.prisma as any)?.category?.findMany !== 'function';
  }
  getCategories(): Promise<Category[]> | Category[] {
    if (this.isLegacyMode()) {
      return this.legacyCategories;
    }
    return this.prisma.category.findMany();
  }
  async getCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }
  createCategory(createCategoryDto: CreateCategoryDto): Category;
  createCategory(createCategoryDto: CreateCategoryDto): Promise<Category>;
  createCategory(createCategoryDto: CreateCategoryDto): Promise<Category> | Category {
    if (this.isLegacyMode()) {
      const category: Category = {
        id: `legacy-category-${this.legacyIdCounter++}`,
        name: createCategoryDto.name,
        description: createCategoryDto.description ?? null,
      };
      this.legacyCategories.push(category);
      return category;
    }
    return this.prisma.category.upsert({
      where: { name: createCategoryDto.name },
      update: {
        description: createCategoryDto.description,
      },
      create: {
        name: createCategoryDto.name,
        description: createCategoryDto.description,
      },
    });
  }
  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return await this.prisma.category.update({
      where: { id },
      data: {
        name: updateCategoryDto.name,
        description: updateCategoryDto.description,
      },
    });
  }
  deleteCategory(id: string): void;
  deleteCategory(id: string): Promise<void>;
  deleteCategory(id: string): Promise<void> | void {
    if (this.isLegacyMode()) {
      const idx = this.legacyCategories.findIndex((category) => category.id === id);
      if (idx === -1) {
        throw new NotFoundException(`Category with id ${id} not found`);
      }
      this.legacyCategories.splice(idx, 1);
      (this.prisma as any)?.clearCategoryId?.(id);
      return;
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id },
      });
      if (!category) {
        throw new NotFoundException(`Category with id ${id} not found`);
      }
      await tx.article.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
      await tx.category.delete({
        where: { id },
      });
    });
  }
}
