import { Expose, Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import type { IdentityJwkResponseInterface, IdentityJwksResponseInterface } from '@marketplace/contracts-core';

export class IdentityJwkDto implements IdentityJwkResponseInterface {
  @Expose()
  @IsString()
  kty: string;

  @Expose()
  @IsString()
  crv: string;

  @Expose()
  @IsString()
  x: string;

  @Expose()
  @IsString()
  y: string;

  @Expose()
  @IsString()
  kid: string;

  @Expose()
  @IsString()
  alg: string;

  @Expose()
  @IsString()
  use: string;
}

export class IdentityJwksDto implements IdentityJwksResponseInterface {
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdentityJwkDto)
  keys: IdentityJwkDto[];
}
