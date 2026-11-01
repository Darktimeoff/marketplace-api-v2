import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MediaStatusEnum, type MediaUploadPartsResponseInterface } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';
import { MediaResponseService } from '../service/media-response.service.js';
import { MediaPartPlanService } from '../service/media-part-plan.service.js';
import { MEDIA_PART_URLS_PER_REQUEST, MEDIA_UPLOAD_URL_TTL_SECONDS } from '../constant/media-upload.constant.js';

@Injectable()
export class MediaUploadPartsCommandHandler {
  private readonly logger = new Logger(MediaUploadPartsCommandHandler.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly responses: MediaResponseService,
    private readonly plan: MediaPartPlanService,
  ) {}

  async execute(publicId: string, ownerIdentityPublicId: string): Promise<MediaUploadPartsResponseInterface> {
    const media = await this.media.findOwned(publicId, ownerIdentityPublicId);

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    if (media.status !== MediaStatusEnum.PENDING || !media.uploadId) {
      throw new ConflictException('Media has no multipart upload in progress');
    }

    const partCount = this.plan.partCount(media.sizeBytes);
    const uploaded = new Set((await this.storage.listParts(media, media.uploadId)).map((part) => part.partNumber));
    const missing: number[] = [];

    for (let partNumber = 1; partNumber <= partCount && missing.length < MEDIA_PART_URLS_PER_REQUEST; partNumber++) {
      if (!uploaded.has(partNumber)) {
        missing.push(partNumber);
      }
    }

    const expiresAt = new Date(Date.now() + MEDIA_UPLOAD_URL_TTL_SECONDS * 1000);
    const parts = [];

    for (const partNumber of missing) {
      const url = await this.storage.presignPart(media, media.uploadId, partNumber, this.plan.partLength(media.sizeBytes, partNumber));
      parts.push({ partNumber, url });
    }

    this.logger.log(`parts signed media=${media.publicId} uploaded=${uploaded.size}/${partCount} signed=[${missing.join(',')}]`);
    return this.responses.toParts(media, this.plan.partSize(media.sizeBytes), partCount, uploaded.size, parts, expiresAt);
  }
}
