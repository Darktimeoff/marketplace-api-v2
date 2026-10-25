import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IdentityExternalAccount, type IdentityExternalAccountCreateEntityInterface } from '../entity/identity-external-account.entity.js';
import type { IdentityProviderEnum } from '../enum/identity-provider.enum.js';

@Injectable()
export class IdentityExternalAccountRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: IdentityExternalAccountCreateEntityInterface): Promise<IdentityExternalAccount> {
    const accounts = this.txHost.tx.getRepository(IdentityExternalAccount);
    return accounts.save(accounts.create(input));
  }

  findByProviderSubject(provider: IdentityProviderEnum, subject: string): Promise<IdentityExternalAccount | null> {
    return this.txHost.tx.getRepository(IdentityExternalAccount).findOne({ where: { provider, subject } });
  }
}
