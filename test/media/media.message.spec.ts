import { describe, expect, it } from 'vitest';
import { MediaClaimStatusEnum, MediaKindEnum, MediaVariantNameEnum } from '@marketplace/contracts-core';
import { MediaMessage } from '../../src/media/message/media.message.js';
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

describe('MediaMessage', () => {
  it('answers a claim with the media in the order the caller asked for, not the database order', () => {
    const first = aMedia('11111111-1111-4111-8111-111111111111');
    const second = aMedia('22222222-2222-4222-8222-222222222222', { kind: MediaKindEnum.VIDEO, mimeType: 'video/mp4', sizeBytes: 11534336 });

    const response = new MediaMessage().toClaimed([second.publicId, first.publicId], [first, second]);

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

    const [claimed] = new MediaMessage().toClaimed([media.publicId], [media]).media;

    expect(Object.keys(claimed).toSorted()).toEqual(['id', 'kind', 'mimeType', 'sizeBytes', 'storageKey']);
  });
  it('asks for variants with a work-queue outbox row keyed by the media, carrying only its public id', () => {
    const media = aMedia('33333333-3333-4333-8333-333333333333');

    expect(new MediaMessage().toVariantsGenerateOutbox(media.publicId)).toEqual({
      id: media.publicId,
      broker: 'rabbitmq',
      topic: 'media.variants',
      aggregateType: 'Media',
      aggregateId: media.publicId,
      type: 'media.variants.generate',
      payload: { mediaPublicId: media.publicId },
    });
  });

  it('announces generated variants as a kafka event keyed by the media', () => {
    const media = aMedia('44444444-4444-4444-8444-444444444444');
    const variants = [{ mediaId: 1, name: MediaVariantNameEnum.W320, mimeType: 'image/webp', storageKey: 'media/owner/4/w320.webp', width: 320, height: 160, sizeBytes: 900 }];

    expect(new MediaMessage().toVariantsGeneratedOutbox(media, variants, 'LggS', new Date('2026-11-01T10:00:00.000Z'))).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      broker: 'kafka',
      topic: 'media.events',
      aggregateType: 'Media',
      aggregateId: media.publicId,
      type: 'media.variants.generated',
      payload: {
        mediaPublicId: media.publicId,
        thumbHash: 'LggS',
        variants: [{ name: MediaVariantNameEnum.W320, mimeType: 'image/webp', storageKey: 'media/owner/4/w320.webp', width: 320, height: 160 }],
        generatedAt: '2026-11-01T10:00:00.000Z',
      },
    });
  });
});
