import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AmqpConnection, MessageHandlerErrorBehavior, Nack } from '@golevelup/nestjs-rabbitmq';
import type { ConfirmChannel } from 'amqplib';
import { RabbitMqChannelEnum } from './enum/rabbitmq-channel.enum.js';
import { JobRejectedException } from '../messaging/exception/job-rejected.exception.js';
import type { JobSubscriberInterface, JobSubscriptionInterface } from '../messaging/interface/job-subscriber.interface.js';

@Injectable()
export class RabbitMqJobSubscriber implements JobSubscriberInterface, OnApplicationBootstrap {
  private readonly logger = new Logger(RabbitMqJobSubscriber.name);
  private readonly subscriptions: JobSubscriptionInterface[] = [];

  constructor(private readonly amqpConnection: AmqpConnection) {}

  register(subscription: JobSubscriptionInterface): void {
    this.subscriptions.push(subscription);
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const subscription of this.subscriptions) {
      await this.declare(subscription);
      await this.consume(subscription);
    }
  }

  private async declare({ queue, deliveryLimit }: JobSubscriptionInterface): Promise<void> {
    const deadLetterExchange = `${queue}.dlx`;
    const deadLetterQueue = `${queue}.dlq`;

    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(deadLetterExchange, 'direct', { durable: true });
      await channel.assertQueue(deadLetterQueue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
      await channel.bindQueue(deadLetterQueue, deadLetterExchange, queue);
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': deadLetterExchange,
          'x-dead-letter-routing-key': queue,
          'x-delivery-limit': deliveryLimit,
        },
      });
    });
  }

  private async consume({ queue, handle }: JobSubscriptionInterface): Promise<void> {
    await this.amqpConnection.createSubscriber(
      async (message: unknown) => {
        try {
          await handle(message);
          return undefined;
        } catch (error) {
          if (error instanceof JobRejectedException) {
            this.logger.warn(`${queue} dead-lettered: ${error.message}`);
            return new Nack(false);
          }

          throw error;
        }
      },
      {
        queue,
        createQueueIfNotExists: false,
        queueOptions: { channel: RabbitMqChannelEnum.WORK },
        errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
      },
      `${RabbitMqJobSubscriber.name}:${queue}`,
    );
    this.logger.log(`consuming ${queue}`);
  }
}
