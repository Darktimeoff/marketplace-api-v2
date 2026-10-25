import { Body, Controller, Cookies, Get, HttpCode, HttpStatus, Post, Redirect, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { Identity } from '../../generic/auth/decorator/identity.decorator.js';
import type { AccessTokenClaimsInterface } from '../../generic/auth/interface/access-token-claims.interface.js';
import { IdentityMeDto } from '../dto/identity-me.dto.js';
import { IdentityGoogleAuthorizeCommandHandler } from '../command-handler/identity-google-authorize.command-handler.js';
import { IdentityGoogleSignInCommandHandler } from '../command-handler/identity-google-sign-in.command-handler.js';
import { GOOGLE_SIGN_IN_TTL_SECONDS } from '../constant/google-sign-in.constant.js';
import { GoogleSignInCookieEnum } from '../enum/google-sign-in-cookie.enum.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly register: IdentityRegisterCommandHandler,
    private readonly login: IdentityLoginCommandHandler,
    private readonly refresh: IdentityRefreshCommandHandler,
    private readonly logout: IdentityLogoutCommandHandler,
    private readonly googleAuthorize: IdentityGoogleAuthorizeCommandHandler,
    private readonly googleSignIn: IdentityGoogleSignInCommandHandler,
  ) {}

  @Public()
  @ResponseDto(IdentityTokenDto)
  @Post('register')
  registerIdentity(@Body() input: IdentityRegisterInput): Promise<IdentityTokenDto> {
    return this.register.execute(input);
  }

  @Public()
  @ResponseDto(IdentityTokenDto)
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: IDENTITY_LOGIN_THROTTLE_LIMIT, ttl: IDENTITY_LOGIN_THROTTLE_TTL_MS, getTracker: identityLoginTracker } })
  @Post('login')
  loginIdentity(@Body() input: IdentityLoginInput): Promise<IdentityTokenDto> {
    return this.login.execute(input);
  }

  @Public()
  @ResponseDto(IdentityTokenDto)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refreshTokens(@Body() input: IdentityRefreshTokenInput): Promise<IdentityTokenDto> {
    return this.refresh.execute(input);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logoutIdentity(@Body() input: IdentityRefreshTokenInput): Promise<void> {
    return this.logout.execute(input);
  }

  @Public()
  @Redirect()
  @Get('google')
  async signInWithGoogle(@Res({ passthrough: true }) response: Response): Promise<{ url: string }> {
    const start = await this.googleAuthorize.execute();

    response.cookie(GoogleSignInCookieEnum.NAME, start.state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: start.secureCookie,
      path: GoogleSignInCookieEnum.PATH,
      maxAge: GOOGLE_SIGN_IN_TTL_SECONDS * 1000,
    });

    return { url: start.url.href };
  }

  @Public()
  @ResponseDto(IdentityTokenDto)
  @Get('google/callback')
  googleCallback(
    @Req() request: Request,
    @Cookies(GoogleSignInCookieEnum.NAME) browserState: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdentityTokenDto> {
    response.clearCookie(GoogleSignInCookieEnum.NAME, { path: GoogleSignInCookieEnum.PATH });

    return this.googleSignIn.execute(new URL(request.originalUrl, 'http://callback').searchParams, browserState);
  }

  @ResponseDto(IdentityMeDto)
  @Get('me')
  me(@Identity() identity: AccessTokenClaimsInterface): IdentityMeDto {
    return identity;
  }
}
