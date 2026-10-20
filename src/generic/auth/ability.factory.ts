import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { RoleEnum } from '../../identity/enum/role.enum.js';
import type { AccessTokenClaimsInterface } from './interface/access-token-claims.interface.js';
import type { AppAbilityType } from './app-ability.type.js';

@Injectable()
export class AbilityFactory {
  createFor(identity: AccessTokenClaimsInterface): AppAbilityType {
    const { can, build } = new AbilityBuilder<AppAbilityType>(createMongoAbility);

    can('create', 'Order');

    if (identity.role === RoleEnum.admin || identity.role === RoleEnum.owner) {
      can('read', 'Order');
    } else {
      can('read', 'Order', { ownerIdentityPublicId: identity.identityPublicId });
    }

    if (identity.role === RoleEnum.seller || identity.role === RoleEnum.admin || identity.role === RoleEnum.owner) {
      can('create', 'Product');
    }

    return build();
  }
}
