import { Controller, Get, Header } from '@nestjs/common';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { Public } from '../../generic/auth/decorator/public.decorator.js';
import { JwtVerificationKeysService } from '../../generic/auth/jwt-verification-keys.service.js';
import { IdentityJwksDto } from '../dto/identity-jwks.dto.js';

@Controller('.well-known')
export class JwksController {
  constructor(private readonly verificationKeys: JwtVerificationKeysService) {}

  @Public()
  @ResponseDto(IdentityJwksDto)
  @Header('Cache-Control', 'public, max-age=60')
  @Get('jwks.json')
  jwks(): IdentityJwksDto {
    return { keys: this.verificationKeys.publicKeys };
  }
}
