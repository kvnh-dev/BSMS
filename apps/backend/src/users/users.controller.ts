import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from '@bsms/shared';
import { UsersService } from './users.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { RequirePersonas } from '../auth/personas.decorator.js';

// Owner-only per the RBAC matrix (plan §5: "Manage worker accounts").
@RequirePersonas('OWNER')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.users.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput) {
    return this.users.update(id, body);
  }
}
