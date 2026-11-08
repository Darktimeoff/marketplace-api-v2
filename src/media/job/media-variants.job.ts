import { Injectable, Logger } from '@nestjs/common';
import { MessageHandlerErrorBehavior, Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqChannelEnum } from '../../generic/rabbitmq/enum/rabbitmq-channel.enum.js';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';
import { MediaVariantsGenerateCommandHandler } from '../command-handler/media-variants-generate.command-handler.js';
import { MediaUnprocessableException } from '../exception/media-unprocessable.exception.js';
import { mediaVariantsGenerateSchema } from '../schema/media-variants-generate.schema.js';

@Injectable()
export class MediaVariantsJob {
  private readonly logger = new Logger(MediaVariantsJob.name);

  constructor(private readonly generate: MediaVariantsGenerateCommandHandler) {}

  @RabbitSubscribe({
    queue: MediaQueueEnum.VARIANTS,
    createQueueIfNotExists: false,
    queueOptions: { channel: RabbitMqChannelEnum.WORK },
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  async handle(message: unknown): Promise<Nack | undefined> {
    const parsed = mediaVariantsGenerateSchema.safeParse(message);

    if (!parsed.success) {
      this.logger.warn(`rejected variants message: ${parsed.error.message}`);
      return new Nack(false);
    }

    try {
      await this.generate.execute(parsed.data.data.mediaPublicId);
      return undefined;
    } catch (error) {
      if (error instanceof MediaUnprocessableException) {
        this.logger.warn(`dead-lettered variants media=${parsed.data.data.mediaPublicId}: ${error.message}`);
        return new Nack(false);
      }

      throw error;
    }
  }
}
