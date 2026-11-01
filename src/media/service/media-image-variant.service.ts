import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaKindEnum } from '@marketplace/contracts-core';
import { MEDIA_IMAGE_VARIANTS, MEDIA_WEBP_QUALITY } from '../constant/media-variant.constant.js';
import { MediaUnprocessableException } from '../exception/media-unprocessable.exception.js';
import type { MediaEncodedInterface } from '../interface/media-encoded.interface.js';
import type { MediaEncodedVariantInterface } from '../interface/media-encoded-variant.interface.js';
import type { MediaVariantEncoderInterface } from '../interface/media-variant-encoder.interface.js';

@Injectable()
export class MediaImageVariantService implements MediaVariantEncoderInterface {
  readonly kind = MediaKindEnum.IMAGE;

  async encode(sourcePath: string, outputDir: string): Promise<MediaEncodedInterface> {
    const width = await this.orientedWidth(sourcePath);
    const fitting = MEDIA_IMAGE_VARIANTS.filter((variant) => variant.width <= width);
    const targets = fitting.length > 0 ? fitting : MEDIA_IMAGE_VARIANTS.slice(0, 1);
    const variants: MediaEncodedVariantInterface[] = [];

    for (const target of targets) {
      const path = join(outputDir, `${target.name}.webp`);
      const info = await sharp(sourcePath)
        .rotate()
        .resize({ width: target.width, withoutEnlargement: true })
        .webp({ quality: MEDIA_WEBP_QUALITY })
        .toFile(path);
      variants.push({ name: target.name, mimeType: 'image/webp', extension: 'webp', path, width: info.width, height: info.height, sizeBytes: info.size });
    }

    return { variants, thumbHashSourcePath: sourcePath };
  }

  private async orientedWidth(sourcePath: string): Promise<number> {
    try {
      const metadata = await sharp(sourcePath).metadata();
      return metadata.autoOrient.width;
    } catch (error) {
      throw new MediaUnprocessableException(sourcePath, error instanceof Error ? error.message : String(error));
    }
  }
}
