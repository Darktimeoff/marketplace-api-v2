import { describe, expect, it } from 'vitest';
import { MediaClaimStatusEnum, MediaKindEnum } from '@marketplace/contracts-core';
import { MediaMessageService } from '../../src/media/service/media-message.service.js';
import type { Media } from '../../src/media/entity/media.entity.js';

function aMedia(publicId: string, overrides: Partial<Media> = {}): Media {
  return {
    publicId,
    kind: MediaKindEnum.IMAGE,
    mimeType: 'image/png',
    sizeBytes: 1024,
    storageKey: `media/owner/${publicId}.png`,
    ...overrides,
  } as Media;
}

describe('MediaMessageService', () => {
  it('answers a claim with the media in the order the caller asked for, not the database order', () => {
    const first = aMedia('11111111-1111-4111-8111-111111111111');
    const second = aMedia('22222222-2222-4222-8222-222222222222', { kind: MediaKindEnum.VIDEO, mimeType: 'video/mp4', sizeBytes: 11534336 });

    const response = new MediaMessageService().toClaimed([second.publicId, first.publicId], [first, second]);

    expect(response).toEqual({
      status: MediaClaimStatusEnum.CLAIMED,
      media: [
        { id: second.publicId, kind: MediaKindEnum.VIDEO, mimeType: 'video/mp4', sizeBytes: 11534336, storageKey: second.storageKey },
        { id: first.publicId, kind: MediaKindEnum.IMAGE, mimeType: 'image/png', sizeBytes: 1024, storageKey: first.storageKey },
      ],
    });
  });

  it('never leaks the internal integer id or the owner', () => {
    const media = aMedia('33333333-3333-4333-8333-333333333333', { id: 7, ownerPublicId: 'owner' } as Partial<Media>);

    const [claimed] = new MediaMessageService().toClaimed([media.publicId], [media]).media;

    expect(Object.keys(claimed).toSorted()).toEqual(['id', 'kind', 'mimeType', 'sizeBytes', 'storageKey']);
  });
});
