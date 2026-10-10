import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccessTokenVerifierService } from './access-token-verifier.service.js';
import type { AuthenticatedRequestInterface } from './interface/authenticated-request.interface.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly verifier: AccessTokenVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();
    const [scheme, token, ...rest] = (request.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token || rest.length > 0) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.identity = await this.verifier.verify(token);
    return true;
  }
}
