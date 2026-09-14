import { UnprocessableEntityException } from "@nestjs/common";

export class InsufficientBalanceException extends UnprocessableEntityException {
  balance: number = 0;
  amount: number = 0
  
  constructor(balance: number, amount: number) {
    super()
  }
}