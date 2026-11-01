import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AccountCustomerChargeRpc, SourceEnum, type CloudEventInterface } from "@marketplace/messaging-contracts";

@Injectable()
export class AccountMessage {
  toChargeReply(
    request: CloudEventInterface<string, AccountCustomerChargeRpc.RequestInterface>,
    data: AccountCustomerChargeRpc.ResponseType,
  ): CloudEventInterface<string, AccountCustomerChargeRpc.ResponseType> {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: SourceEnum.ACCOUNT,
      type: `${AccountCustomerChargeRpc.METHOD}.response`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: request.subject,
      correlationid: request.id,
      data,
    }
  }
}
