import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryService } from 'src/category/category.service';

function makePrismaMock() {
  return {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(
      (callback: (tx: unknown) => unknown | Promise<unknown>) =>
        Promise.resolve(
          callback({
            category: {
              findUnique: vi.fn(),
              delete: vi.fn(),
            },
            article: {
              updateMany: vi.fn(),
            },
          }),
        ),
    ),
  };
}

let prisma: ReturnType<typeof makePrismaMock>;
let categoryService: CategoryService;

beforeEach(() => {
  prisma = makePrismaMock();
  categoryService = new CategoryService(prisma as unknown as PrismaService);
});

function prismaCategoryRow(
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
  }>,
) {
  return {
    id: '1',
    name: 'Category 1',
    description: 'Description 1',
    ...overrides,
  };
}

describe('CategoryService', () => {
  it('should return all categories', async () => {
    const mockCategories = [prismaCategoryRow({})];

    prisma.category.findMany.mockResolvedValue(mockCategories);
    await categoryService.getCategories();
    expect(prisma.category.findMany).toHaveBeenCalledWith();
  });
});

describe('getCategory', () => {
  it('should return category by id', async () => {
    const row = prismaCategoryRow({});
    prisma.category.findUnique.mockResolvedValue(row);

    const result = await categoryService.getCategory(row.id);

    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
    });
    expect(result).toMatchObject({
      id: row.id,
      name: row.name,
      description: row.description,
    });
  });

  it('getCategory throws when not found', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      categoryService.getCategory('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('createCategory', () => {
  it('createCategory creates category for editor', async () => {
    const dto = {
      name: 'Category 1',
      description: 'Description 1',
    };

    prisma.category.upsert.mockResolvedValue(
      prismaCategoryRow({
        name: dto.name,
        description: dto.description,
      }),
    );

    await categoryService.createCategory(dto);

    expect(prisma.category.upsert).toHaveBeenCalledWith({
      where: { name: dto.name },
      update: {
        description: dto.description,
      },
      create: {
        name: dto.name,
        description: dto.description,
      },
    });
  });
});

describe('deleteCategory', () => {
  it('runs transaction: unlinks articles then deletes category', async () => {
    const row = prismaCategoryRow({});
    const tx = {
      category: {
        findUnique: vi.fn().mockResolvedValue(row),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      article: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation((cb) => Promise.resolve(cb(tx)));

    await categoryService.deleteCategory(row.id);

    expect(tx.category.findUnique).toHaveBeenCalledWith({
      where: { id: row.id },
    });
    expect(tx.article.updateMany).toHaveBeenCalledWith({
      where: { categoryId: row.id },
      data: { categoryId: null },
    });
    expect(tx.category.delete).toHaveBeenCalledWith({
      where: { id: row.id },
    });
  });

  it('throws when category not found inside transaction', async () => {
    const tx = {
      category: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
      article: {
        updateMany: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation((cb) => Promise.resolve(cb(tx)));

    await expect(
      categoryService.deleteCategory('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.article.updateMany).not.toHaveBeenCalled();
    expect(tx.category.delete).not.toHaveBeenCalled();
  });
});

describe('updateCategory', () => {
  it('updates category', async () => {
    const existing = prismaCategoryRow({
      id: 'category-1',
    });
    prisma.category.findUnique.mockResolvedValue(existing);

    const updateDto = {
      name: 'Updated name',
      description: 'Updated description',
    };

    const updatedRow = prismaCategoryRow({
      id: existing.id,
      name: updateDto.name,
      description: updateDto.description,
    });
    prisma.category.update.mockResolvedValue(updatedRow);

    await categoryService.updateCategory(existing.id, updateDto);

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        name: updateDto.name,
        description: updateDto.description,
      },
    });
  });

  it('throws NotFoundException when category missing', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(
      categoryService.updateCategory('550e8400-e29b-41d4-a716-446655440000', {
        name: 'Updated name',
        description: 'Updated description',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});

describe('CategoryService legacy mode', () => {
  it('createCategory and deleteCategory use in-memory store', () => {
    const legacyPrisma = {} as unknown as PrismaService;
    const svc = new CategoryService(legacyPrisma);

    const c = svc.createCategory({
      name: 'L1',
      description: 'D1',
    });
    expect(c.name).toBe('L1');
    expect(svc.getCategories() as (typeof c)[]).toHaveLength(1);

    svc.deleteCategory(c.id);
    expect((svc.getCategories() as unknown[]).length).toBe(0);
  });

  it('deleteCategory throws when id missing in legacy store', () => {
    const legacyPrisma = {} as unknown as PrismaService;
    const svc = new CategoryService(legacyPrisma);

    expect(() =>
      svc.deleteCategory('550e8400-e29b-41d4-a716-446655440000'),
    ).toThrow(NotFoundException);
  });
});
