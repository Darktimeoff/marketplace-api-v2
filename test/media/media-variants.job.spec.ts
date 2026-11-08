import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Nack } from '@golevelup/nestjs-rabbitmq';
import { MediaVariantsJob } from '../../src/media/job/media-variants.job.js';
import { MediaUnprocessableException } from '../../src/media/exception/media-unprocessable.exception.js';
import type { MediaVariantsGenerateCommandHandler } from '../../src/media/command-handler/media-variants-generate.command-handler.js';

function aJob(execute: () => Promise<void>) {
  return new MediaVariantsJob({ execute: vi.fn(execute) } as unknown as MediaVariantsGenerateCommandHandler);
}

function aMessage(mediaPublicId: string = randomUUID()) {
  return { specversion: '1.0', id: mediaPublicId, type: 'media.variants.generate', data: { mediaPublicId } };
}

describe('MediaVariantsJob', () => {
  it('acks once the variants are generated', async () => {
    const generate = vi.fn().mockResolvedValue(undefined);
    const job = new MediaVariantsJob({ execute: generate } as unknown as MediaVariantsGenerateCommandHandler);
    const message = aMessage();

    expect(await job.handle(message)).toBeUndefined();
    expect(generate).toHaveBeenCalledWith(message.data.mediaPublicId);
  });

  it('dead-letters a malformed message without calling the handler', async () => {
    const generate = vi.fn();
    const job = new MediaVariantsJob({ execute: generate } as unknown as MediaVariantsGenerateCommandHandler);

    for (const message of [null, { ...aMessage(), data: { mediaPublicId: 'not-a-uuid' } }, { ...aMessage(), type: 'media.other' }]) {
      const result = await job.handle(message);
      expect(result).toBeInstanceOf(Nack);
      expect((result as Nack).requeue).toBe(false);
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it('dead-letters a file that cannot be decoded, since a retry cannot fix it', async () => {
    const result = await aJob(() => Promise.reject(new MediaUnprocessableException('media/x.png', 'unsupported image format'))).handle(aMessage());

    expect(result).toBeInstanceOf(Nack);
    expect((result as Nack).requeue).toBe(false);
  });

  it('rethrows any other failure so the broker requeues it up to the delivery limit', async () => {
    await expect(aJob(() => Promise.reject(new Error('storage unavailable'))).handle(aMessage())).rejects.toThrow('storage unavailable');
  });
});
