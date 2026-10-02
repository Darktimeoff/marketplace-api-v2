import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Identity, type IdentityCreateEntityInterface } from '../entity/identity.entity.js';

@Injectable()
export class IdentityRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: IdentityCreateEntityInterface): Promise<Identity> {
    const identities = this.txHost.tx.getRepository(Identity);
    return identities.save(identities.create(input));
  }

  findById(id: Identity['id']): Promise<Identity | null> {
    return this.txHost.tx.getRepository(Identity).findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<Identity | null> {
    return this.txHost.tx.getRepository(Identity).findOne({ where: { email } });
  }

  findByPhone(fullNumber: string): Promise<Identity | null> {
    return this.txHost.tx.getRepository(Identity).findOne({ where: { loginPhone: { fullNumber } } });
  }
}
