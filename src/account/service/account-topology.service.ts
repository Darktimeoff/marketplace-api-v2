import { Injectable, OnModuleInit } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfirmChannel } from "amqplib";
import { TopicEnum } from "@marketplace/messaging-contracts";
import { AccountCustomerChargeTopogolyEnum } from "../enum/acccount-customer-charge-topology.enum.js";
import { AccountCustomerRefundTopologyEnum } from "../enum/account-customer-refund-topology.enum.js";


@Injectable()
export class AccountTopology implements OnModuleInit {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(TopicEnum.ACCOUNT_COMMANDS, 'topic', { durable: true })
      await channel.assertExchange(AccountCustomerChargeTopogolyEnum.DLX, 'topic', { durable: true })
      await channel.assertQueue(AccountCustomerChargeTopogolyEnum.DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } })
      await channel.bindQueue(AccountCustomerChargeTopogolyEnum.DLQ, AccountCustomerChargeTopogolyEnum.DLX, AccountCustomerChargeTopogolyEnum.QUEUE)
      await channel.assertQueue(AccountCustomerRefundTopologyEnum.DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } })
      await channel.bindQueue(AccountCustomerRefundTopologyEnum.DLQ, AccountCustomerRefundTopologyEnum.DLX, AccountCustomerRefundTopologyEnum.QUEUE)
    })
  }
}
