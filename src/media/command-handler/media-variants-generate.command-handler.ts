import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaStatusEnum } from '@marketplace/contracts-core';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaVariantRepository } from '../repository/media-variant.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';
import { MediaVariantEncoderResolverService } from '../service/media-variant-encoder-resolver.service.js';
import { MediaThumbHashService } from '../service/media-thumbhash.service.js';
import { MediaOutboxRepository } from '../repository/media-outbox.repository.js';
import { MediaMessage } from '../message/media.message.js';
import type { Media } from '../entity/media.entity.js';
import type { MediaVariantCreateEntityInterface } from '../entity/media-variant.entity.js';
import type { MediaEncodedVariantInterface } from '../interface/media-encoded-variant.interface.js';

@Injectable()
export class MediaVariantsGenerateCommandHandler {
  private readonly logger = new Logger(MediaVariantsGenerateCommandHandler.name);

  constructor(
    private readonly media: MediaRepository,
    private readonly variants: MediaVariantRepository,
    private readonly storage: MediaStorageService,
    private readonly encoders: MediaVariantEncoderResolverService,
    private readonly thumbHashes: MediaThumbHashService,
    private readonly outbox: MediaOutboxRepository,
    private readonly messages: MediaMessage,
  ) {}

  async execute(mediaPublicId: Media['publicId']): Promise<void> {
    const media = await this.media.findByPublicId(mediaPublicId);

    if (!media || media.status !== MediaStatusEnum.READY) {
      this.logger.warn(`skipped variants media=${mediaPublicId}: ${media ? media.status : 'gone'}`);
      return;
    }

    if (await this.variants.existsForMedia(media.id)) {
      this.logger.log(`skipped variants media=${mediaPublicId}: already generated`);
      return;
    }

    const workDir = await mkdtemp(join(tmpdir(), 'media-variants-'));

    try {
      const sourcePath = join(workDir, 'source');
      await this.storage.downloadToFile(media.storageKey, sourcePath);
      const encoded = await this.encoders.forKind(media.kind).encode(sourcePath, workDir);
      const thumbHash = await this.thumbHashes.fromImage(encoded.thumbHashSourcePath);

      for (const variant of encoded.variants) {
        await this.storage.uploadFile(this.variantKey(media, variant), variant.path, variant.mimeType);
      }

      await this.save(media, encoded.variants, thumbHash);
      this.logger.log(`generated variants media=${mediaPublicId} ${encoded.variants.map((variant) => `${variant.name}=${variant.width}x${variant.height}/${variant.sizeBytes}`).join(' ')}`);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  @Transactional()
  private async save(media: Media, encoded: MediaEncodedVariantInterface[], thumbHash: string): Promise<void> {
    const variants = encoded.map((variant) => this.toVariant(media, variant));
    const inserted = await this.variants.createManyIgnoringExisting(variants);

    if (inserted.length === 0) {
      return;
    }

    await this.media.setThumbHash(media.id, thumbHash);
    await this.outbox.create(this.messages.toVariantsGeneratedOutbox(media, variants, thumbHash, new Date()));
  }

  private toVariant(media: Media, variant: MediaEncodedVariantInterface): MediaVariantCreateEntityInterface {
    return {
      mediaId: media.id,
      name: variant.name,
      mimeType: variant.mimeType,
      storageKey: this.variantKey(media, variant),
      width: variant.width,
      height: variant.height,
      sizeBytes: variant.sizeBytes,
    };
  }

  private variantKey(media: Media, variant: MediaEncodedVariantInterface): string {
    return `${media.storageKey.replace(/\.[^./]+$/, '')}/${variant.name}.${variant.extension}`;
  }
}
