import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { CreateCategoryDto } from 'src/category/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/category/dto/update-category.dto';

describe('CategoryDtoValidation', () => {
  describe('CreateCategoryDto', () => {
    it('passes with valid payload', async () => {
      const dto = new CreateCategoryDto();
      dto.name = 'Tech';
      dto.description = 'Tech articles';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when name is empty', async () => {
      const dto = new CreateCategoryDto();
      dto.name = '';
      dto.description = 'Desc';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('fails when description is empty', async () => {
      const dto = new CreateCategoryDto();
      dto.name = 'Tech';
      dto.description = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });

    it('fails when name is not a string', async () => {
      const dto = plainToInstance(CreateCategoryDto, {
        name: 1,
        description: 'x',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });
  });

  describe('UpdateCategoryDto', () => {
    it('passes with valid payload', async () => {
      const dto = new UpdateCategoryDto();
      dto.name = 'Tech';
      dto.description = 'Updated';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when name is empty', async () => {
      const dto = new UpdateCategoryDto();
      dto.name = '';
      dto.description = 'x';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });
  });
});
