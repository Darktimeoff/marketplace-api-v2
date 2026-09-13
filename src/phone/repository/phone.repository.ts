import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Phone, type PhoneCreateEntityInterface } from '../../entities/phone.entity.js';

@Injectable()
export class PhoneRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: PhoneCreateEntityInterface): Promise<Phone> {
    const phones = this.txHost.tx.getRepository(Phone);
    return phones.save(phones.create(input));
  }
}
