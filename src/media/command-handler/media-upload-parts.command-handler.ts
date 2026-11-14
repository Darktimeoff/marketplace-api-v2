import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Log } from '../../generic/decorator/log.decorator.js';
import { MediaStatusEnum, type MediaUploadPartsResponseInterface } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';
import { MediaResponse } from '../response/media.response.js';
import { MediaPartPlanService } from '../service/media-part-plan.service.js';
import { MEDIA_PART_URLS_PER_REQUEST, MEDIA_UPLOAD_URL_TTL_SECONDS } from '../constant/media-upload.constant.js';

@Injectable()
export class MediaUploadPartsCommandHandler {

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly responses: MediaResponse,
    private readonly plan: MediaPartPlanService,
  ) {}

  @Log(undefined, response => `parts signed media=${response.id} uploaded=${response.uploadedPartCount}/${response.partCount} signed=[${response.parts.map(({ partNumber }) => partNumber).join(',')}]`)
  async execute(publicId: string, ownerPublicId: string): Promise<MediaUploadPartsResponseInterface> {
    const media = await this.media.findOwned(publicId, ownerPublicId);

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

    return this.responses.toParts(media, this.plan.partSize(media.sizeBytes), partCount, uploaded.size, parts, expiresAt);
  }
}
