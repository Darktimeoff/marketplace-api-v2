import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { IdentityTokenDto } from '../dto/identity-token.dto.js';
import { IdentityRegisterInput } from '../input/identity-register.input.js';
import { IdentityLoginInput } from '../input/identity-login.input.js';
import { IdentityRefreshTokenInput } from '../input/identity-refresh-token.input.js';
import { IdentityRegisterCommandHandler } from '../command-handler/identity-register.command-handler.js';
import { IdentityLoginCommandHandler } from '../command-handler/identity-login.command-handler.js';
import { IdentityRefreshCommandHandler } from '../command-handler/identity-refresh.command-handler.js';
import { IdentityLogoutCommandHandler } from '../command-handler/identity-logout.command-handler.js';
import { IDENTITY_LOGIN_THROTTLE_LIMIT, IDENTITY_LOGIN_THROTTLE_TTL_MS, identityLoginTracker } from '../constant/identity-login-throttle.constant.js';
import { Public } from '../../generic/auth/decorator/public.decorator.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly register: IdentityRegisterCommandHandler,
    private readonly login: IdentityLoginCommandHandler,
    private readonly refresh: IdentityRefreshCommandHandler,
    private readonly logout: IdentityLogoutCommandHandler,
  ) {}

  @ResponseDto(IdentityTokenDto)
  @Post('register')
  registerIdentity(@Body() input: IdentityRegisterInput): Promise<IdentityTokenDto> {
    return this.register.execute(input);
  }

  @ResponseDto(IdentityTokenDto)
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: IDENTITY_LOGIN_THROTTLE_LIMIT, ttl: IDENTITY_LOGIN_THROTTLE_TTL_MS, getTracker: identityLoginTracker } })
  @Post('login')
  loginIdentity(@Body() input: IdentityLoginInput): Promise<IdentityTokenDto> {
    return this.login.execute(input);
  }

  @ResponseDto(IdentityTokenDto)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refreshTokens(@Body() input: IdentityRefreshTokenInput): Promise<IdentityTokenDto> {
    return this.refresh.execute(input);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logoutIdentity(@Body() input: IdentityRefreshTokenInput): Promise<void> {
    return this.logout.execute(input);
  }
}
