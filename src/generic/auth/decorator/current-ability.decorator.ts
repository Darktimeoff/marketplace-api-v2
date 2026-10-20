import { createParamDecorator, InternalServerErrorException, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequestInterface } from '../interface/authenticated-request.interface.js';

export const CurrentAbility = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const { ability } = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();

  if (!ability) {
    throw new InternalServerErrorException('@CurrentAbility() requires AbilityGuard on an authenticated route');
  }

  return ability;
});
