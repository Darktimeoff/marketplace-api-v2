import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Phone } from '../../entities/phone.entity.js';
import { CreatePhoneDto } from '../dto/create-phone.dto.js';

@Injectable()
export class PhoneRepository {
  constructor(@InjectRepository(Phone) private readonly phones: Repository<Phone>) {}

  create(dto: CreatePhoneDto): Promise<Phone> {
    return this.phones.save(this.phones.create(dto));
  }
}
