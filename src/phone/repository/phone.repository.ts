import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Phone } from '../../entities/phone.entity.js';
import { CreatePhoneDto } from '../dto/create-phone.dto.js';

@Injectable()
export class PhoneRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(dto: CreatePhoneDto): Promise<Phone> {
    const phones = this.txHost.tx.getRepository(Phone);
    return phones.save(phones.create(dto));
  }
}
