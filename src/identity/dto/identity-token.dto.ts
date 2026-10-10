import { Expose } from 'class-transformer';
import { IsIn, IsInt, IsJWT, IsPositive, IsString } from 'class-validator';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';

export class IdentityTokenDto implements IdentityTokenResponseInterface {
  @Expose()
  @IsJWT()
  accessToken: string;

  @Expose()
  @IsString()
  refreshToken: string;

  @Expose()
  @IsIn(['Bearer'])
  tokenType: 'Bearer';

  @Expose()
  @IsInt()
  @IsPositive()
  expiresIn: number;
}
