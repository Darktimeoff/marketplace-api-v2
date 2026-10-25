import type { MongoAbility } from '@casl/ability';

export type AppActionType = 'create' | 'read';

export interface OrderSubjectInterface {
  ownerIdentityPublicId: string | null;
}

export type AppSubjectType = 'Order' | 'Product' | (OrderSubjectInterface & { __caslSubjectType__: 'Order' });

export type AppAbilityType = MongoAbility<[AppActionType, AppSubjectType]>;
