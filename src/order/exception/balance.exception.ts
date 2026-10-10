import { UnprocessableEntityException } from "@nestjs/common";

export class BalanceException extends UnprocessableEntityException {
  constructor(readonly customerId: number, readonly balance: number, readonly amount: number) {
    super()
  }
}