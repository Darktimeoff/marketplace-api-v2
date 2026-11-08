import { Nack, RabbitRPC } from "@golevelup/nestjs-rabbitmq";
import { AccountCustomerChargeRpc, TopicEnum, type CloudEventInterface } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { isUUID } from "class-validator";
import { AccountRpcTopologyEnum } from "../enum/account-rpc-topology.enum.js";
import { AccountCustomerChargeCommandHandler } from "../command-handler/account-customer-charge.command-handler.js";
import { AccountMessage } from "../message/account.message.js";

@Injectable()
export class AccountGateway {
  private readonly logger = new Logger(AccountGateway.name)

  constructor(
    private readonly customerCharge: AccountCustomerChargeCommandHandler,
    private readonly messages: AccountMessage,
  ) {}

  @RabbitRPC({
    exchange: TopicEnum.ACCOUNT_COMMANDS,
    routingKey: AccountCustomerChargeRpc.METHOD,
    queue: AccountRpcTopologyEnum.CHARGE_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': AccountRpcTopologyEnum.DLX,
        'x-dead-letter-routing-key': AccountRpcTopologyEnum.CHARGE_QUEUE,
      },
      consumerOptions: {
        noAck: false,
      },
    },
  })
  async handleCharge(
    msg: CloudEventInterface<string, AccountCustomerChargeRpc.RequestInterface>,
  ): Promise<CloudEventInterface<string, AccountCustomerChargeRpc.ResponseType> | Nack> {
    if (msg?.specversion !== '1.0' || msg.type !== AccountCustomerChargeRpc.METHOD || !isUUID(msg.id) || !this.isValidCharge(msg.data)) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    return this.messages.toChargeReply(msg, await this.customerCharge.execute(msg.data))
  }

  private isValidCharge(data: Partial<AccountCustomerChargeRpc.RequestInterface> | undefined): boolean {
    return isUUID(data?.chargeId)
      && isUUID(data?.customerPublicId)
      && typeof data?.amount === 'string'
      && /^\d{1,10}(\.\d{1,2})?$/.test(data.amount)
      && Number(data.amount) > 0
  }
}
