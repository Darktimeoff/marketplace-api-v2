import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity.js';
import { Address } from './entity/address.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Address])],
})
export class UserModule {}
