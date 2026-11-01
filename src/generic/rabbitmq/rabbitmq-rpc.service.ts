import { Injectable } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { CloudEventInterface } from "@marketplace/messaging-contracts";
import type { RabbitMqRpcCallInterface } from "./interface/rabbitmq-rpc-call.interface.js";

@Injectable()
export class RabbitMqRpcService {
  private readonly timeoutMs = 5000

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async request<TData, TResponse>(call: RabbitMqRpcCallInterface<TData>): Promise<TResponse> {
    const { data } = await this.amqpConnection.request<CloudEventInterface<string, TResponse>>({
      exchange: call.exchange,
      routingKey: call.method,
      payload: this.toEnvelope(call),
      timeout: this.timeoutMs,
      expiration: this.timeoutMs,
    })

    return data
  }

  private toEnvelope<TData>(call: RabbitMqRpcCallInterface<TData>): CloudEventInterface<string, TData> {
    return {
      specversion: '1.0',
      id: call.id,
      source: call.source,
      type: call.method,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: call.id,
      correlationid: call.id,
      data: call.data,
    }
  }
}
