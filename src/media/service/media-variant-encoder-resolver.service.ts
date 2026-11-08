import { Injectable } from '@nestjs/common';
import type { MediaKindEnum } from '@marketplace/contracts-core';
import { MediaImageVariantService } from './media-image-variant.service.js';
import { MediaVideoVariantService } from './media-video-variant.service.js';
import type { MediaVariantEncoderInterface } from '../interface/media-variant-encoder.interface.js';

@Injectable()
export class MediaVariantEncoderResolverService {
  private readonly encoders: Map<MediaKindEnum, MediaVariantEncoderInterface>;

  constructor(image: MediaImageVariantService, video: MediaVideoVariantService) {
    this.encoders = new Map([image, video].map((encoder) => [encoder.kind, encoder]));
  }

  forKind(kind: MediaKindEnum): MediaVariantEncoderInterface {
    const encoder = this.encoders.get(kind);

    if (!encoder) {
      throw new Error(`no variant encoder for media kind ${kind}`);
    }

    return encoder;
  }
}
