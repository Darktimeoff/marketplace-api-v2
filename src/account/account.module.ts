import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entity/transaction.entity.js';
import { AccountRepository } from './repository/account.repository.js';
import { AccountService } from './service/account.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  providers: [AccountRepository, AccountService],
  exports: [AccountService],
})
export class AccountModule {}
