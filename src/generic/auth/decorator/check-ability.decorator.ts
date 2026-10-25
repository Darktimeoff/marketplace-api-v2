import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { AppActionType } from '../app-ability.type.js';

export const CHECK_ABILITY_METADATA = 'auth:ability';

export interface AbilityRequirementInterface {
  action: AppActionType;
  subject: 'Order' | 'Product';
}

export function CheckAbility(action: AppActionType, subject: AbilityRequirementInterface['subject']): CustomDecorator<string> {
  return SetMetadata(CHECK_ABILITY_METADATA, { action, subject } satisfies AbilityRequirementInterface);
}
