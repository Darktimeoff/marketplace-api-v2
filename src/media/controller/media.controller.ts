import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Redirect } from '@nestjs/common';
import type { MediaResponseInterface, MediaUploadPartsResponseInterface, MediaUploadResponseInterface } from '@marketplace/contracts-core';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';
import { CheckAbility } from '../../generic/auth/decorator/check-ability.decorator.js';
import { Identity } from '../../generic/auth/decorator/identity.decorator.js';
import { IdempotencyKey } from '../../generic/decorator/idempotency-key.decorator.js';
import { CurrentAbility } from '../../generic/auth/decorator/current-ability.decorator.js';
import type { AppAbilityType } from '../../generic/auth/app-ability.type.js';
import { MediaService } from '../service/media.service.js';
import { MediaUploadRequestCommandHandler } from '../command-handler/media-upload-request.command-handler.js';
import { MediaUploadCompleteCommandHandler } from '../command-handler/media-upload-complete.command-handler.js';
import { MediaUploadPartsCommandHandler } from '../command-handler/media-upload-parts.command-handler.js';
import { MediaUploadInput } from '../input/media-upload.input.js';
import { MediaUploadDto } from '../dto/media-upload.dto.js';
import { MediaDto } from '../dto/media.dto.js';
import { MediaUploadPartsDto } from '../dto/media-upload-parts.dto.js';

@Controller('media')
export class MediaController {
  constructor(
    private readonly uploadRequest: MediaUploadRequestCommandHandler,
    private readonly uploadComplete: MediaUploadCompleteCommandHandler,
    private readonly uploadParts: MediaUploadPartsCommandHandler,
    private readonly mediaService: MediaService,
  ) {}

  @CheckAbility('read', 'Media')
  @Header('Cache-Control', 'no-store')
  @Redirect()
  @Get(':id')
  async download(@Param('id', ParseUUIDPipe) id: string, @CurrentAbility() ability: AppAbilityType): Promise<{ url: string; statusCode: number }> {
    return { url: await this.mediaService.downloadUrl(id, ability), statusCode: HttpStatus.FOUND };
  }

  @ResponseDto(MediaUploadDto)
  @HttpCode(HttpStatus.OK)
  @CheckAbility('create', 'Media')
  @Post('upload')
  requestUpload(
    @Body() input: MediaUploadInput,
    @Identity('identityPublicId') identityPublicId: string,
    @IdempotencyKey(new ParseUUIDPipe({ optional: true })) idempotencyKey?: string,
  ): Promise<MediaUploadResponseInterface> {
    return this.uploadRequest.execute(input, identityPublicId, idempotencyKey ?? null);
  }

  @ResponseDto(MediaUploadPartsDto)
  @CheckAbility('create', 'Media')
  @Get(':id/parts')
  uploadPartUrls(
    @Param('id', ParseUUIDPipe) id: string,
    @Identity('identityPublicId') identityPublicId: string,
  ): Promise<MediaUploadPartsResponseInterface> {
    return this.uploadParts.execute(id, identityPublicId);
  }

  @ResponseDto(MediaDto)
  @HttpCode(HttpStatus.OK)
  @CheckAbility('create', 'Media')
  @Post(':id/complete')
  completeUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Identity('identityPublicId') identityPublicId: string,
  ): Promise<MediaResponseInterface> {
    return this.uploadComplete.execute(id, identityPublicId);
  }
}
