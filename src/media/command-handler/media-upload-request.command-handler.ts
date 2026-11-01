import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { randomUUID } from 'node:crypto';
import { MediaStatusEnum, type MediaUploadResponseInterface } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';
import { MediaResponseService } from '../service/media-response.service.js';
import { MEDIA_UPLOAD_TYPES } from '../constant/media-upload.constant.js';
import { MediaUploadInput } from '../input/media-upload.input.js';
import type { Media } from '../entity/media.entity.js';

@Injectable()
export class MediaUploadRequestCommandHandler {
  private readonly logger = new Logger(MediaUploadRequestCommandHandler.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly responses: MediaResponseService,
  ) {}

  async execute(input: MediaUploadInput, ownerIdentityPublicId: string, idempotencyKey: string | null): Promise<MediaUploadResponseInterface> {
    const type = MEDIA_UPLOAD_TYPES[input.mimeType];

    if (input.sizeBytes > type.maxSizeBytes) {
      throw new BadRequestException(`${input.mimeType} is limited to ${type.maxSizeBytes} bytes`);
    }

    const media = await this.findOrCreate(input, ownerIdentityPublicId, idempotencyKey);

    if (media.status !== MediaStatusEnum.PENDING) {
      throw new ConflictException('Media is already uploaded');
    }

    this.logger.log(`upload requested media=${media.publicId} key=${media.storageKey} size=${media.sizeBytes}`);
    return this.responses.toUpload(media, await this.storage.presignUpload(media));
  }

  @Transactional()
  private async findOrCreate(input: MediaUploadInput, ownerIdentityPublicId: string, idempotencyKey: string | null): Promise<Media> {
    if (idempotencyKey) {
      await this.media.lockIdempotencyKey(ownerIdentityPublicId, idempotencyKey);
      const requested = await this.media.findByIdempotencyKey(ownerIdentityPublicId, idempotencyKey);

      if (requested) {
        if (requested.mimeType !== input.mimeType || requested.sizeBytes !== input.sizeBytes) {
          throw new ConflictException('Idempotency-Key was already used for another upload');
        }

        return requested;
      }
    }

    const type = MEDIA_UPLOAD_TYPES[input.mimeType];

    return this.media.create({
      ownerIdentityPublicId,
      kind: type.kind,
      storageKey: `media/${ownerIdentityPublicId}/${randomUUID()}.${type.extension}`,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadId: null,
      idempotencyKey,
    });
  }
}
