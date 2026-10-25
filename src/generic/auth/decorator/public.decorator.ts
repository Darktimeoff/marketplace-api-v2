import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_METADATA = 'auth:public';

export const Public = () => SetMetadata(IS_PUBLIC_METADATA, true);
