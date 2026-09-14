import { UnprocessableEntityException } from '@nestjs/common';

export class InsufficientBalanceException extends UnprocessableEntityException {
  constructor(
    readonly balance: number,
    readonly amount: number,
  ) {
    super(`Insufficient balance: ${balance} available, ${amount} required`);
  }
}
