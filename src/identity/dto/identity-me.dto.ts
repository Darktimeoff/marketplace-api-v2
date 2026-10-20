import { Expose } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import type { IdentityMeResponseInterface } from '@marketplace/contracts-core';

export class IdentityMeDto implements IdentityMeResponseInterface {
  @Expose()
  @IsUUID()
  identityPublicId: string;

  @Expose()
  @IsString()
  role: string;

  @Expose()
  @IsOptional()
  @IsString()
  email: string | null;

  @Expose()
  @IsOptional()
  @IsString()
  phoneNumber: string | null;
}
