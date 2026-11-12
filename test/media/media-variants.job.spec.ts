import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MediaVariantsJob } from '../../src/media/job/media-variants.job.js';
import { MediaUnprocessableException } from '../../src/media/exception/media-unprocessable.exception.js';
import { JobRejectedException } from '../../src/generic/messaging/exception/job-rejected.exception.js';
import type { JobSubscriberInterface, JobSubscriptionInterface } from '../../src/generic/messaging/interface/job-subscriber.interface.js';
import type { MediaVariantsGenerateCommandHandler } from '../../src/media/command-handler/media-variants-generate.command-handler.js';

function aJob(execute: (mediaPublicId: string) => Promise<void>) {
  let subscription!: JobSubscriptionInterface;
  const jobs = { register: (registered: JobSubscriptionInterface) => { subscription = registered; } } as unknown as JobSubscriberInterface;
  const generate = vi.fn(execute);
  new MediaVariantsJob(jobs, { execute: generate } as unknown as MediaVariantsGenerateCommandHandler).onModuleInit();
  return { subscription, generate };
}

function aMessage(mediaPublicId: string = randomUUID()) {
  return { specversion: '1.0', id: mediaPublicId, type: 'media.variants.generate', data: { mediaPublicId } };
}

describe('MediaVariantsJob', () => {
  it('registers the variants queue with its delivery limit', () => {
    expect(aJob(() => Promise.resolve()).subscription).toMatchObject({ queue: 'media.variants', deliveryLimit: 5 });
  });

  it('finishes once the variants are generated', async () => {
    const { subscription, generate } = aJob(() => Promise.resolve());
    const message = aMessage();

    await expect(subscription.handle(message)).resolves.toBeUndefined();
    expect(generate).toHaveBeenCalledWith(message.data.mediaPublicId);
  });

  it('rejects a malformed message without calling the handler', async () => {
    const { subscription, generate } = aJob(() => Promise.resolve());

    for (const message of [null, { ...aMessage(), data: { mediaPublicId: 'not-a-uuid' } }, { ...aMessage(), type: 'media.other' }]) {
      await expect(subscription.handle(message)).rejects.toBeInstanceOf(JobRejectedException);
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects a file that cannot be decoded, since a retry cannot fix it', async () => {
    const { subscription } = aJob(() => Promise.reject(new MediaUnprocessableException('media/x.png', 'unsupported image format')));

    await expect(subscription.handle(aMessage())).rejects.toBeInstanceOf(JobRejectedException);
  });

  it('rethrows any other failure so the broker requeues it up to the delivery limit', async () => {
    const { subscription } = aJob(() => Promise.reject(new Error('storage unavailable')));

    await expect(subscription.handle(aMessage())).rejects.toThrow('storage unavailable');
    await expect(subscription.handle(aMessage())).rejects.not.toBeInstanceOf(JobRejectedException);
  });
});
