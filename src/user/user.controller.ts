import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { PageDto } from 'src/common/dto/page-query.dto';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { sortData } from 'src/common/utils/sort';
import { PublicUser } from './user.types';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort by field',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    description: 'Sort order',
  })
 async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query() rawQuery?: Record<string, unknown>,
  ): Promise<PublicUser[] | PageDto<PublicUser>> {
    const users = await this.userService.getUsers();
    const hasSorting =
      typeof rawQuery?.sortBy === 'string' &&
      (rawQuery.sortBy as string).length > 0;
    const sortedUsers = hasSorting
      ? sortData(users, sortBy, order, ['role'])
      : users;
    const hasPagination =
      rawQuery?.page !== undefined || rawQuery?.limit !== undefined;
    if (hasPagination) {
      const safePage = Number.isFinite(page) ? page : 1;
      const safeLimit = Number.isFinite(limit) ? limit : 10;
      const pagedUsers = sortedUsers.slice(
        (safePage - 1) * safeLimit,
        safePage * safeLimit,
      );
      return new PageDto(pagedUsers, sortedUsers.length, safePage, safeLimit);
    }
    return sortedUsers;
  }

  @Get(':id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getUser(id);
  }

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }
  @Put(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<PublicUser> {
    return this.userService.updateUser(id, updatePasswordDto);
  }
  @Delete(':id')
  @HttpCode(204) // Or use @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.userService.deleteUser(id);
  }
}
