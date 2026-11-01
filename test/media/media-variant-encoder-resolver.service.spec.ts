import { describe, expect, it } from 'vitest';
import { MediaKindEnum } from '@marketplace/contracts-core';
import { MediaVariantEncoderResolverService } from '../../src/media/service/media-variant-encoder-resolver.service.js';
import { MediaImageVariantService } from '../../src/media/service/media-image-variant.service.js';
import { MediaVideoVariantService } from '../../src/media/service/media-video-variant.service.js';

describe('MediaVariantEncoderResolverService', () => {
  const image = new MediaImageVariantService();
  const video = new MediaVideoVariantService();
  const resolver = new MediaVariantEncoderResolverService(image, video);

  it('picks the encoder that declares the media kind', () => {
    expect(resolver.forKind(MediaKindEnum.IMAGE)).toBe(image);
    expect(resolver.forKind(MediaKindEnum.VIDEO)).toBe(video);
  });

  it('fails loudly for a kind no encoder declares', () => {
    expect(() => resolver.forKind('audio' as MediaKindEnum)).toThrow('no variant encoder for media kind audio');
  });
});
