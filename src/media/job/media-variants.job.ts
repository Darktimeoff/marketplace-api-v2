import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { JOB_SUBSCRIBER } from '../../generic/messaging/constant/messaging.constant.js';
import { JobRejectedException } from '../../generic/messaging/exception/job-rejected.exception.js';
import type { JobSubscriberInterface } from '../../generic/messaging/interface/job-subscriber.interface.js';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';
import { MediaVariantsGenerateCommandHandler } from '../command-handler/media-variants-generate.command-handler.js';
import { MediaUnprocessableException } from '../exception/media-unprocessable.exception.js';
import { mediaVariantsGenerateSchema } from '../schema/media-variants-generate.schema.js';

@Injectable()
export class MediaVariantsJob implements OnModuleInit {
  private readonly deliveryLimit = 5;

  constructor(
    @Inject(JOB_SUBSCRIBER) private readonly jobs: JobSubscriberInterface,
    private readonly generate: MediaVariantsGenerateCommandHandler,
  ) {}

  onModuleInit(): void {
    this.jobs.register({
      queue: MediaQueueEnum.VARIANTS,
      deliveryLimit: this.deliveryLimit,
      handle: (message) => this.handle(message),
    });
  }

  private async handle(message: unknown): Promise<void> {
    const parsed = mediaVariantsGenerateSchema.safeParse(message);

    if (!parsed.success) {
      throw new JobRejectedException(`rejected variants message: ${parsed.error.message}`);
    }

    try {
      await this.generate.execute(parsed.data.data.mediaPublicId);
    } catch (error) {
      if (error instanceof MediaUnprocessableException) {
        throw new JobRejectedException(`variants media=${parsed.data.data.mediaPublicId}: ${error.message}`);
      }

      throw error;
    }
  }
}
