import type { MongoAbility } from '@casl/ability';

export type AppActionType = 'create' | 'read';

export interface OrderSubjectInterface {
  ownerIdentityPublicId: string | null;
}

export interface MediaSubjectInterface {
  ownerIdentityPublicId: string;
}

export type AppSubjectType =
  | 'Order'
  | 'Product'
  | 'Media'
  | (OrderSubjectInterface & { __caslSubjectType__: 'Order' })
  | (MediaSubjectInterface & { __caslSubjectType__: 'Media' });

export type AppAbilityType = MongoAbility<[AppActionType, AppSubjectType]>;
