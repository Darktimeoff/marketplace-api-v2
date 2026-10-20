import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, Logger, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AbilityGuard } from '../../../src/generic/auth/ability.guard.js';
import { AbilityFactory } from '../../../src/generic/auth/ability.factory.js';
import { RoleEnum } from '../../../src/identity/enum/role.enum.js';
import type { AbilityRequirementInterface } from '../../../src/generic/auth/decorator/check-ability.decorator.js';
import type { AuthenticatedRequestInterface } from '../../../src/generic/auth/interface/authenticated-request.interface.js';
import type { AccessTokenClaimsInterface } from '../../../src/generic/auth/interface/access-token-claims.interface.js';

function run(role: RoleEnum | undefined, required: AbilityRequirementInterface | undefined) {
  const headers: Record<string, string> = {};
  const request: AuthenticatedRequestInterface = { headers: {}, identity: role ? ({ identityPublicId: 'p', role } as AccessTokenClaimsInterface) : undefined };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader: (name: string, value: string) => { headers[name] = value; } }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  const guard = new AbilityGuard({ getAllAndOverride: () => required } as unknown as Reflector, new AbilityFactory());
  return { result: () => guard.canActivate(context), headers, request };
}

describe('AbilityGuard', () => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

  it('puts the ability on the request for checks after the resource is loaded', () => {
    const { result, request } = run(RoleEnum.user, undefined);

    expect(result()).toBe(true);
    expect(request.ability?.can('create', 'Order')).toBe(true);
  });

  it('lets a seller create a product', () => {
    expect(run(RoleEnum.seller, { action: 'create', subject: 'Product' }).result()).toBe(true);
  });

  it('answers 403 with insufficient_scope when the role cannot', () => {
    const { result, headers } = run(RoleEnum.user, { action: 'create', subject: 'Product' });

    expect(result).toThrow(ForbiddenException);
    expect(headers['WWW-Authenticate']).toBe('Bearer error="insufficient_scope"');
  });

  it('ignores non-http handlers such as rabbitmq rpc', () => {
    const guard = new AbilityGuard({ getAllAndOverride: () => ({ action: 'create', subject: 'Product' }) } as unknown as Reflector, new AbilityFactory());
    expect(guard.canActivate({ getType: () => 'rmq' } as unknown as ExecutionContext)).toBe(true);
  });
});
