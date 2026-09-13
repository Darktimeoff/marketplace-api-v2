import { Module } from '@nestjs/common';
import { PhoneRepository } from './repository/phone.repository.js';
import { PhoneService } from './service/phone.service.js';

@Module({
  providers: [PhoneRepository, PhoneService],
  exports: [PhoneService],
})
export class PhoneModule {}
