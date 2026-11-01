import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entity/transaction.entity.js';
import { AccountInbox } from './entity/account-inbox.entity.js';
import { Account } from './entity/account.entity.js';
import { AccountInboxRepository } from './repository/account-inbox.repository.js';
import { AccountInboxService } from './service/account-inbox.service.js';
import { AccountCustomerRefundCommandHandler } from './command-handler/account-customer-refund.command-handler.js';
import { AccountRepository } from './repository/account.repository.js';
import { AccountCustomerChargeCommandHandler } from './command-handler/account-customer-charge.command-handler.js';
import { KafkaModule } from '../generic/kafka/kafka.module.js';
import { AccountCreateCommandHandler } from './command-handler/account-create.command-handler.js';
import { AccountUserEventsConsumer } from './consumer/account-user-events.consumer.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, AccountInbox, Account]), KafkaModule],
  providers: [AccountRepository, AccountInboxRepository, AccountInboxService, AccountCustomerChargeCommandHandler, AccountCustomerRefundCommandHandler, AccountCreateCommandHandler, AccountUserEventsConsumer],
  exports: [AccountCustomerChargeCommandHandler, AccountCustomerRefundCommandHandler],
})
export class AccountModule {}
