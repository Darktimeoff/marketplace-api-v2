import { Injectable } from '@nestjs/common';
import { PhoneRepository } from '../repository/phone.repository.js';
import { PhoneCreateInput } from '../input/phone-create.input.js';
import { Phone } from '../entity/phone.entity.js';

@Injectable()
export class PhoneService {
  constructor(private readonly phoneRepository: PhoneRepository) {}

  /** Всегда создаёт НОВУЮ строку Phone — снапшот, а не ссылку на существующую
   *  (см. заметку в Phone.entity.ts: "fullNumber" намеренно не unique). */
  create(input: PhoneCreateInput): Promise<Phone> {
    return this.phoneRepository.create(input);
  }
}