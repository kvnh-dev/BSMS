import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { categorySchema, type CategoryInput } from '@bsms/shared';
import { CategoriesService } from './categories.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  // "Manage categories" is Owner-only, same as GST slabs (plan §5).
  @RequirePersonas('OWNER')
  @Post()
  create(@Body(new ZodValidationPipe(categorySchema)) body: CategoryInput) {
    return this.categories.create(body);
  }

  @RequirePersonas('OWNER')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(categorySchema.partial())) body: Partial<CategoryInput>,
  ) {
    return this.categories.update(id, body);
  }

  @RequirePersonas('OWNER')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.categories.delete(id);
  }
}
