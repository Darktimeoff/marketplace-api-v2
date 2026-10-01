import { Injectable } from "@nestjs/common";
import type { OrderPlacedEvent } from "@marketplace/messaging-contracts";
import { Transactional } from "@nestjs-cls/transactional";
import { sleep } from "../../generic/util/sleep.util.js";

@Injectable()
export class EmailService {
  constructor() {
    
  }


  @Transactional()
  async sendOrderCreated(order: OrderPlacedEvent.DataInterface) {
    console.log('Send order to user email', order)
    await sleep(1000)
    console.log('Succesfully sent to user email, and saved to db')
  }
}