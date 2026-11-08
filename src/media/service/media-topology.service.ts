import { Injectable, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { ConfirmChannel } from 'amqplib';
import { MediaExchangeEnum } from '../enum/media-exchange.enum.js';
import { MediaQueueEnum } from '../enum/media-queue.enum.js';

@Injectable()
export class MediaTopologyService implements OnModuleInit {
  private readonly variantsDeliveryLimit = 5;

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit(): Promise<void> {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(MediaExchangeEnum.DLX, 'direct', { durable: true });
      await channel.assertQueue(MediaQueueEnum.VARIANTS_DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
      await channel.bindQueue(MediaQueueEnum.VARIANTS_DLQ, MediaExchangeEnum.DLX, MediaQueueEnum.VARIANTS);
      await channel.assertQueue(MediaQueueEnum.VARIANTS, {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': MediaExchangeEnum.DLX,
          'x-dead-letter-routing-key': MediaQueueEnum.VARIANTS,
          'x-delivery-limit': this.variantsDeliveryLimit,
        },
      });
    });
  }
}
