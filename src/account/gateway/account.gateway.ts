import { Nack, RabbitRPC } from "@golevelup/nestjs-rabbitmq";
import { AccountCustomerChargeRequest, StockReserveRequest } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { AccountCustomerChargeTopogolyEnum } from "../enum/acccount-customer-charge-topology.enum.js";
import { AccountCustomerChargeCommandHandler } from "../command-handler/account-customer-charge.command-handler.js";
import { AccountCustomerChargeRejectedException } from "../exception/insufficient-stock.exception.js";


@Injectable()
export class AccountGateway {
  private readonly logger = new Logger(AccountGateway.name)

  constructor(private readonly charge: AccountCustomerChargeCommandHandler) {}

  @RabbitRPC({
    exchange: AccountCustomerChargeRequest.TOPIC,
    routingKey: AccountCustomerChargeRequest.TYPE,
    queue: AccountCustomerChargeTopogolyEnum.QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': AccountCustomerChargeTopogolyEnum.DLX,
        'x-dead-letter-routing-key': AccountCustomerChargeTopogolyEnum.QUEUE
      },
      consumerOptions: {
        noAck: false
      }
    }
  })
  async handleCustomerCharge(msg: AccountCustomerChargeRequest.MessageType): Promise<AccountCustomerChargeRequest.ResponseMessageType | Nack> {
    if (msg?.specversion !== '1.0' || msg.type !== AccountCustomerChargeRequest.TYPE || typeof msg.subject !== 'string' || !isUUID(msg.subject)) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    try {
      await this.charge.execute(msg.data)
      return this.toResponse(msg, { status: 'success' })
    } catch (e) {
      if (e instanceof AccountCustomerChargeRejectedException) {
        return this.toResponse(msg, { status: 'rejected', reason: e.reason, available: e.balance.toFixed(2)})
      }

      throw e
    }
  }

  private toResponse(
    request: AccountCustomerChargeRequest.MessageType,
    data: AccountCustomerChargeRequest.ResponseDataType,
  ): AccountCustomerChargeRequest.ResponseMessageType {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: AccountCustomerChargeRequest.RESPONSE_SOURCE,
      type: AccountCustomerChargeRequest.RESPONSE_TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: request.subject,
      correlationid: request.id,
      data,
    }
  }
}
