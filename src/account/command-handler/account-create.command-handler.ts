import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../repository/account.repository.js';
import { Account } from '../entity/account.entity.js';

@Injectable()
export class AccountCreateCommandHandler {
  constructor(private readonly accounts: AccountRepository) {}

  execute(publicId: Account['publicId']): Promise<boolean> {
    return this.accounts.createIfAbsent(publicId);
  }
}
