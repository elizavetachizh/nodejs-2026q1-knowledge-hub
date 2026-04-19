import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { fromPrismaRole } from 'src/user/utils/user.mapper';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from 'src/user/dto/create-user.dto';
import { LogoutDto, RefreshDto } from './dto/refresh.dto';
import { JwtPayload } from './auth.types';
import { UsersWriteService } from 'src/user/user-credentials.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersWriteService: UsersWriteService,
  ) {}

  //helpers
  private getAccessSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET_REFRESH_KEY;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }
    return secret;
  }

  private getAccessTtl(): string {
    return process.env.JWT_ACCESS_TTL ?? '15m';
  }

  private getRefreshTtl(): string {
    return process.env.JWT_REFRESH_TTL ?? '7d';
  }

  private getSaltRounds(): number {
    const parsed = Number(process.env.CRYPT_SALT);
    if (!Number.isFinite(parsed) || parsed <= 0) return 10;
    return parsed;
  }

  private async issueTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.signAsync(payload, {
      secret: this.getAccessSecret(),
      expiresIn: this.getAccessTtl(),
    });
    const refreshToken = this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshTtl(),
    });
    return { accessToken: await accessToken, refreshToken: await refreshToken };
  }

  private async saveRefreshHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.getSaltRounds(),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { login: loginDto.login },
    });
    if (!user) {
      throw new ForbiddenException('Authentication failed');
    }

    const passwordOk = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordOk) {
      throw new ForbiddenException('Authentication failed');
    }
    const payload: JwtPayload = {
      userId: user.id,
      role: fromPrismaRole(user.role),
      login: user.login,
    };
    const tokens = await this.issueTokens(payload);
    await this.saveRefreshHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async signup(signupDto: SignupDto): Promise<{ id: string; message: string }> {
    const user = await this.usersWriteService.createUserWithPassword({
      login: signupDto.login,
      password: signupDto.password,
      role: UserRole.VIEWER,
    });
    return { id: user.id, message: 'User created successfully' };
  }

  async refreshToken(
    refreshTokenDto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshTokenDto.refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(
        refreshTokenDto.refreshToken,
        {
          secret: this.getRefreshSecret(),
        },
      );
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.refreshTokenHash) {
      throw new ForbiddenException('Invalid refresh token');
    }
    const rtMatches = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      user.refreshTokenHash,
    );
    if (!rtMatches) throw new ForbiddenException('Invalid refresh token');
    const newPayload: JwtPayload = {
      userId: user.id,
      role: fromPrismaRole(user.role),
      login: user.login,
    };
    const newTokens = await this.issueTokens(newPayload);
    await this.saveRefreshHash(user.id, newTokens.refreshToken);
    return newTokens;
  }
  async logout(logoutDto: LogoutDto): Promise<{ message: string }> {
    if (!logoutDto.refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(logoutDto.refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.refreshTokenHash) {
      throw new ForbiddenException('Invalid refresh token');
    }
    const rtMatches = await bcrypt.compare(
      logoutDto.refreshToken,
      user.refreshTokenHash,
    );
    if (!rtMatches) {
      throw new ForbiddenException('Invalid refresh token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out successfully' };
  }
}
