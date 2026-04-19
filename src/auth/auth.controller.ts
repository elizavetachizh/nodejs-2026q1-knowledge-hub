import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { LogoutDto, RefreshDto } from './dto/refresh.dto';
import { AppThrottlerGuard } from 'src/common/guards/throttler.guard';

const getPositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
};

const authLoginTtl = getPositiveInt(process.env.THROTTLE_AUTH_LOGIN_TTL, 60000);
const authLoginLimit = getPositiveInt(
  process.env.THROTTLE_AUTH_LOGIN_LIMIT,
  100,
);
const authSignupTtl = getPositiveInt(
  process.env.THROTTLE_AUTH_SIGNUP_TTL,
  60000,
);
const authSignupLimit = getPositiveInt(
  process.env.THROTTLE_AUTH_SIGNUP_LIMIT,
  100,
);

@Controller('auth')
@UseGuards(AppThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({
    default: { ttl: authLoginTtl, limit: authLoginLimit },
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.login(loginDto);
  }

  @Post('signup')
  @Throttle({
    default: { ttl: authSignupTtl, limit: authSignupLimit },
  })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshToken(refreshTokenDto);
  }
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() logoutDto: LogoutDto): Promise<{ message: string }> {
    return this.authService.logout(logoutDto);
  }
}
