import { Injectable } from '@nestjs/common';
import { PhoneRepository } from '../repository/phone.repository.js';
import { CreatePhoneDto } from '../dto/create-phone.dto.js';
import { Phone } from '../../entities/phone.entity.js';

@Injectable()
export class PhoneService {
  constructor(private readonly phoneRepository: PhoneRepository) {}

  /** Всегда создаёт НОВУЮ строку Phone — снапшот, а не ссылку на существующую
   *  (см. заметку в Phone.entity.ts: "fullNumber" намеренно не unique). */
  create(dto: CreatePhoneDto): Promise<Phone> {
    return this.phoneRepository.create(dto);
  }
}
