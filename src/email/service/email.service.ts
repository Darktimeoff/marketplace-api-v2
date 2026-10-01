import { Injectable } from "@nestjs/common";
import type { OrderCreatedDataJobInterface } from "../../generic/rabbitmq/interface/order-created-data-job.interface.js";
import { Transactional } from "@nestjs-cls/transactional";
import { BaseJobInterface } from "../../generic/rabbitmq/interface/base-job.interface.js";
import { EmailInboxRepository } from "../repository/email-inbox.repository.js";
import { sleep } from "../../generic/util/sleep.util.js";

@Injectable()
export class EmailService {
  constructor(private readonly inbox: EmailInboxRepository) {
    
  }


  @Transactional()
  async sendOrderCreated(order: OrderCreatedDataJobInterface) {
    console.log('Send order to user email', order.id)
    await sleep(1000)
    console.log('Succesfully sent to user email, and saved to db')
  }
}