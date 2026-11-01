import { Injectable, OnModuleInit } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { ConfirmChannel } from "amqplib";
import { TopicEnum } from "@marketplace/messaging-contracts";
import { AccountRpcTopologyEnum } from "../enum/account-rpc-topology.enum.js";

@Injectable()
export class AccountTopologyService implements OnModuleInit {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async onModuleInit() {
    await this.amqpConnection.managedChannel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(TopicEnum.ACCOUNT_COMMANDS, 'topic', { durable: true })
      await channel.assertExchange(AccountRpcTopologyEnum.DLX, 'topic', { durable: true })
      await channel.assertQueue(AccountRpcTopologyEnum.CHARGE_DLQ, { durable: true, arguments: { 'x-queue-type': 'quorum' } })
      await channel.bindQueue(AccountRpcTopologyEnum.CHARGE_DLQ, AccountRpcTopologyEnum.DLX, AccountRpcTopologyEnum.CHARGE_QUEUE)
    })
  }
}
