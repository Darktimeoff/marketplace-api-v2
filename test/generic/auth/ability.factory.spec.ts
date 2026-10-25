import { describe, expect, it } from 'vitest';
import { subject } from '@casl/ability';
import { AbilityFactory } from '../../../src/generic/auth/ability.factory.js';
import { RoleEnum } from '../../../src/identity/enum/role.enum.js';
import type { AccessTokenClaimsInterface } from '../../../src/generic/auth/interface/access-token-claims.interface.js';

const me = '5f0c8a5e-2b7d-4c1e-9a43-0d6f1e2b3c4d';
const someoneElse = '7c1d9e4a-3b2f-4a6e-8d0c-5f9b1a2e3c4d';

function abilityOf(role: RoleEnum) {
  return new AbilityFactory().createFor({ identityPublicId: me, role } as AccessTokenClaimsInterface);
}

function order(ownerIdentityPublicId: string) {
  return subject('Order', { ownerIdentityPublicId });
}

describe('AbilityFactory', () => {
  it('lets a buyer create orders and read only their own', () => {
    const ability = abilityOf(RoleEnum.user);

    expect(ability.can('create', 'Order')).toBe(true);
    expect(ability.can('read', order(me))).toBe(true);
    expect(ability.can('read', order(someoneElse))).toBe(false);
    expect(ability.can('create', 'Product')).toBe(false);
  });

  it('lets a seller create products', () => {
    const ability = abilityOf(RoleEnum.seller);

    expect(ability.can('create', 'Product')).toBe(true);
    expect(ability.can('read', order(someoneElse))).toBe(false);
  });

  it('lets admins and owners read every order and create products', () => {
    for (const role of [RoleEnum.admin, RoleEnum.owner]) {
      const ability = abilityOf(role);

      expect(ability.can('read', order(someoneElse))).toBe(true);
      expect(ability.can('create', 'Product')).toBe(true);
    }
  });

  it('answers a type-level question for a buyer as "maybe", the instance decides', () => {
    expect(abilityOf(RoleEnum.user).can('read', 'Order')).toBe(true);
  });
});
