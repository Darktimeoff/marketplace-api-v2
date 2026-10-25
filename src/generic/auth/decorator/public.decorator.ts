import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_METADATA = 'auth:public';

export function Public(): CustomDecorator<string> {
  return SetMetadata(IS_PUBLIC_METADATA, true);
}
