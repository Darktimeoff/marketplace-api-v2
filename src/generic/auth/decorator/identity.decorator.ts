import { createParamDecorator, InternalServerErrorException, type ExecutionContext } from '@nestjs/common';
import type { AccessTokenClaimsInterface } from '../interface/access-token-claims.interface.js';
import type { AuthenticatedRequestInterface } from '../interface/authenticated-request.interface.js';

export const Identity = createParamDecorator(
  (field: keyof AccessTokenClaimsInterface | undefined, context: ExecutionContext) => {
    const { identity } = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();

    if (!identity) {
      throw new InternalServerErrorException('@Identity() requires AccessTokenGuard on the route');
    }

    return field ? identity[field] : identity;
  },
);
