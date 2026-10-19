import { Nack, RabbitRPC } from "@golevelup/nestjs-rabbitmq";
import { AccountCustomerChargeRequest, AccountCustomerRefundRequest } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { AccountCustomerChargeTopogolyEnum } from "../enum/acccount-customer-charge-topology.enum.js";
import { AccountCustomerChargeCommandHandler } from "../command-handler/account-customer-charge.command-handler.js";
import { AccountCustomerRefundCommandHandler } from "../command-handler/account-customer-refund.command-handler.js";
import { AccountCustomerRefundTopologyEnum } from "../enum/account-customer-refund-topology.enum.js";
import { AccountInboxConsumerEnum } from "../enum/account-inbox-consumer.enum.js";
import { AccountInboxService } from "../service/account-inbox.service.js";
import { AccountCustomerChargeRejectedException } from "../exception/insufficient-stock.exception.js";


@Injectable()
export class AccountGateway {
  private readonly logger = new Logger(AccountGateway.name)

  constructor(
    private readonly charge: AccountCustomerChargeCommandHandler,
    private readonly refund: AccountCustomerRefundCommandHandler,
    private readonly inbox: AccountInboxService,
  ) {}

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
    if (msg?.specversion !== '1.0' || msg.type !== AccountCustomerChargeRequest.TYPE || !isUUID(msg.id) || typeof msg.subject !== 'string' || !isUUID(msg.subject) || !this.isValidMovement(msg.data)) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    try {
      const applied = await this.inbox.processOnce(AccountInboxConsumerEnum.CUSTOMER_CHARGE, msg.id, () => this.charge.execute(msg.data))
      this.logger.log(`${applied ? 'charged' : 'skipped charge'} id=${msg.id}`)
      return this.toResponse(msg, { status: 'success' })
    } catch (e) {
      if (e instanceof AccountCustomerChargeRejectedException) {
        return this.toResponse(msg, { status: 'rejected', reason: e.reason, available: e.balance.toFixed(2)})
      }

      throw e
    }
  }

  @RabbitRPC({
    exchange: AccountCustomerRefundRequest.TOPIC,
    routingKey: AccountCustomerRefundRequest.TYPE,
    queue: AccountCustomerRefundTopologyEnum.QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': AccountCustomerRefundTopologyEnum.DLX,
        'x-dead-letter-routing-key': AccountCustomerRefundTopologyEnum.QUEUE
      },
      consumerOptions: {
        noAck: false
      }
    }
  })
  async handleCustomerRefund(msg: AccountCustomerRefundRequest.MessageType): Promise<AccountCustomerRefundRequest.ResponseMessageType | Nack> {
    if (msg?.specversion !== '1.0' || msg.type !== AccountCustomerRefundRequest.TYPE || !isUUID(msg.id) || !isUUID(msg.data?.chargeId) || !this.isValidMovement(msg.data)) {
      this.logger.warn(`rejected id=${msg?.id}`)
      return new Nack(false)
    }

    let refunded = true
    const applied = await this.inbox.processOnce(AccountInboxConsumerEnum.CUSTOMER_REFUND, msg.id, async () => {
      refunded = await this.refund.execute(msg.data)
    })
    this.logger.log(`${applied ? (refunded ? 'refunded' : 'fenced uncharged') : 'skipped refund'} id=${msg.id}`)
    return this.toRefundResponse(msg, { status: refunded ? 'refunded' : 'not_charged' })
  }

  private isValidMovement(data: Partial<AccountCustomerChargeRequest.DataInterface> | undefined): boolean {
    return Number.isSafeInteger(data?.customerId)
      && Number(data?.customerId) > 0
      && typeof data?.amount === 'string'
      && /^\d{1,10}(\.\d{1,2})?$/.test(data.amount)
      && Number(data.amount) > 0
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

  private toRefundResponse(
    request: AccountCustomerRefundRequest.MessageType,
    data: AccountCustomerRefundRequest.ResponseDataType,
  ): AccountCustomerRefundRequest.ResponseMessageType {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: AccountCustomerRefundRequest.RESPONSE_SOURCE,
      type: AccountCustomerRefundRequest.RESPONSE_TYPE,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: request.subject,
      correlationid: request.id,
      data,
    }
  }
}
