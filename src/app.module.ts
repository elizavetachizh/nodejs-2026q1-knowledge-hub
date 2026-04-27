import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { PrismaModule } from 'prisma/src/prisma/prisma.module';
import { AccessGuard } from './common/guards/access.guard';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './gemini/gemini.module';

const getPositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
};

@Module({
  imports: [
    AiModule,
    JwtModule,
    AuthModule,
    PrismaModule,
    UserModule,
    ArticleModule,
    CategoryModule,
    CommentModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: getPositiveInt(process.env.THROTTLE_TTL, 60000),
          limit: getPositiveInt(process.env.THROTTLE_LIMIT, 120),
        },
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AccessGuard],
})
export class AppModule {}
