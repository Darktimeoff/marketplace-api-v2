import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AccessTokenVerifierService } from './access-token-verifier.service.js';
import { IS_PUBLIC_METADATA } from './decorator/public.decorator.js';
import type { AuthenticatedRequestInterface } from './interface/authenticated-request.interface.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly verifier: AccessTokenVerifierService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_METADATA, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();
    const response = context.switchToHttp().getResponse<Response>();
    const [scheme, token, ...rest] = (request.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token || rest.length > 0) {
      response.setHeader?.('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.identity = await this.verifier.verify(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        response.setHeader?.('WWW-Authenticate', 'Bearer error="invalid_token"');
      }
      throw error;
    }

    return true;
  }
}
