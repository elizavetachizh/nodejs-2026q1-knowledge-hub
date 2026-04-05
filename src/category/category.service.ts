import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from './category.types';
import { CreateCategoryDto } from './dto/create-category.dto';
import { randomUUID } from 'node:crypto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ArticleService } from '../article/article.service';

@Injectable()
export class CategoryService {
  private categories: Category[] = [];
  constructor(private readonly articleService: ArticleService) {}
  getCategories(): Category[] {
    return this.categories;
  }
  getCategory(id: string): Category {
    const category = this.categories.find((category) => category.id === id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }
  createCategory(createCategoryDto: CreateCategoryDto): Category {
    const category: Category = {
      id: randomUUID(),
      name: createCategoryDto.name,
      description: createCategoryDto.description,
    };
    this.categories.push(category);
    return category;
  }
  updateCategory(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = this.categories.find((category) => category.id === id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    category.name = updateCategoryDto.name;
    category.description = updateCategoryDto.description;

    return category;
  }
  deleteCategory(id: string): void {
    const category = this.categories.find((category) => category.id === id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    this.articleService.clearCategoryId(id);
    this.categories = this.categories.filter((category) => category.id !== id);
  }
}
