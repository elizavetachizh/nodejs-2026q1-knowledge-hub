import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { InternalUser, PublicUser } from './user.types';
import { randomUUID } from 'node:crypto';
import { ArticleService } from '../article/article.service';
import { CommentService } from '../comment/comment.service';

@Injectable()
export class UserService {
  private users: InternalUser[] = [];
  constructor(
    @Inject(forwardRef(() => CommentService))
    private readonly commentService: CommentService,
    private readonly articleService: ArticleService,
  ) {}
  private toPublicUser(user: InternalUser): PublicUser {
    return {
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  getUsers(): PublicUser[] {
    return this.users.map((u) => this.toPublicUser(u));
  }

  getUser(id: string): PublicUser {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }
    return this.toPublicUser(user);
  }

  create(createUserDto: CreateUserDto) {
    const now = new Date().getTime();
    const user: InternalUser = {
      id: randomUUID(),
      login: createUserDto.login,
      password: createUserDto.password,
      role: createUserDto.role ? createUserDto.role : UserRole.VIEWER,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return this.toPublicUser(user);
  }

  update(id: string, updatePasswordDto: UpdatePasswordDto) {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }
    if (user.password !== updatePasswordDto.oldPassword) {
      throw new ForbiddenException('Invalid password');
    }
    user.password = updatePasswordDto.newPassword;
    user.updatedAt = new Date().getTime();
    return this.toPublicUser(user);
  }

  delete(id: string): void {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    this.commentService.deleteCommentByAuthorId(id);
    this.articleService.clearAuthorId(id);
    this.users = this.users.filter((u) => u.id !== id);
  }
}
