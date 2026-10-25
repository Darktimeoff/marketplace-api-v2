import { Body, Controller, Cookies, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, Post, Query, Redirect, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { Public } from '../../generic/auth/decorator/public.decorator.js';
import { Identity } from '../../generic/auth/decorator/identity.decorator.js';
import { IdentityTokenDto } from '../dto/identity-token.dto.js';
import { IdentityOidcLinkDto } from '../dto/identity-oidc-link.dto.js';
import { IdentityOidcLinkInput } from '../input/identity-oidc-link.input.js';
import { IdentityOidcAuthorizeCommandHandler } from '../command-handler/identity-oidc-authorize.command-handler.js';
import { IdentityOidcSignInCommandHandler } from '../command-handler/identity-oidc-sign-in.command-handler.js';
import { IdentityOidcLinkCommandHandler } from '../command-handler/identity-oidc-link.command-handler.js';
import { IdentityProviderEnum } from '../enum/identity-provider.enum.js';
import { OidcSignInCookieEnum } from '../enum/oidc-sign-in-cookie.enum.js';
import { OIDC_SIGN_IN_TTL_SECONDS } from '../constant/oidc-sign-in.constant.js';
import { IDENTITY_LOGIN_THROTTLE_LIMIT, IDENTITY_LOGIN_THROTTLE_TTL_MS } from '../constant/identity-login-throttle.constant.js';
import { identityOidcLinkTracker } from '../tracker/identity-oidc-link.tracker.js';
import type { OidcSignInStartInterface } from '../interface/oidc-sign-in-start.interface.js';

@Controller('auth')
export class OidcController {
  constructor(
    private readonly authorize: IdentityOidcAuthorizeCommandHandler,
    private readonly signIn: IdentityOidcSignInCommandHandler,
    private readonly link: IdentityOidcLinkCommandHandler,
  ) {}

  @Public()
  @Redirect()
  @Get(':provider')
  async signInWith(
    @Param('provider', new ParseEnumPipe(IdentityProviderEnum)) provider: IdentityProviderEnum,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ url: string }> {
    return { url: this.toProviderRedirect(response, await this.authorize.execute(provider, null)) };
  }

  @ResponseDto(IdentityOidcLinkDto)
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: IDENTITY_LOGIN_THROTTLE_LIMIT, ttl: IDENTITY_LOGIN_THROTTLE_TTL_MS, getTracker: identityOidcLinkTracker } })
  @Post(':provider/link')
  async linkProvider(
    @Param('provider', new ParseEnumPipe(IdentityProviderEnum)) provider: IdentityProviderEnum,
    @Identity('identityPublicId') identityPublicId: string,
    @Body() input: IdentityOidcLinkInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdentityOidcLinkDto> {
    return { url: this.toProviderRedirect(response, await this.link.execute(provider, identityPublicId, input)) };
  }

  @Public()
  @ResponseDto(IdentityTokenDto)
  @Get(':provider/callback')
  callback(
    @Param('provider', new ParseEnumPipe(IdentityProviderEnum)) provider: IdentityProviderEnum,
    @Query() query: Record<string, string>,
    @Cookies(OidcSignInCookieEnum.NAME) browserState: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdentityTokenDto> {
    response.clearCookie(OidcSignInCookieEnum.NAME, { path: OidcSignInCookieEnum.PATH });

    return this.signIn.execute(provider, new URLSearchParams(query), browserState);
  }

  private toProviderRedirect(response: Response, start: OidcSignInStartInterface): string {
    response.cookie(OidcSignInCookieEnum.NAME, start.state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: start.secureCookie,
      path: OidcSignInCookieEnum.PATH,
      maxAge: OIDC_SIGN_IN_TTL_SECONDS * 1000,
    });

    return start.url.href;
  }
}
