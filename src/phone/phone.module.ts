import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Phone } from './entity/phone.entity.js';
import { PhoneRepository } from './repository/phone.repository.js';
import { PhoneService } from './service/phone.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Phone])],
  providers: [PhoneRepository, PhoneService],
  exports: [PhoneService],
})
export class PhoneModule {}
