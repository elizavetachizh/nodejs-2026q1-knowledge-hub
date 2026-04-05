import { CategoryService } from './category.service';

describe('CategoryService', () => {
  it('should clear article category links before category delete', () => {
    const articleService = {
      clearCategoryId: jest.fn(),
    };
    const service = new CategoryService(articleService as any);

    const category = service.createCategory({
      name: 'Tech',
      description: 'Technology',
    });

    service.deleteCategory(category.id);

    expect(articleService.clearCategoryId).toHaveBeenCalledWith(category.id);
    expect(service.getCategories()).toHaveLength(0);
  });
});
