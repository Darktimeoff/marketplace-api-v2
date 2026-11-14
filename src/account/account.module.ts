import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../generic/messaging/messaging.module.js';
import { Transaction } from './entity/transaction.entity.js';
import { AccountInbox } from './entity/account-inbox.entity.js';
import { Account } from './entity/account.entity.js';
import { AccountInboxRepository } from './repository/account-inbox.repository.js';
import { AccountInboxService } from './service/account-inbox.service.js';
import { AccountCustomerRefundCommandHandler } from './command-handler/account-customer-refund.command-handler.js';
import { AccountRepository } from './repository/account.repository.js';
import { AccountCustomerChargeCommandHandler } from './command-handler/account-customer-charge.command-handler.js';
import { AccountCreateCommandHandler } from './command-handler/account-create.command-handler.js';
import { AccountUserEventsConsumer } from './consumer/account-user-events.consumer.js';
import { AccountGateway } from './gateway/account.gateway.js';
import { AccountTopologyService } from './service/account-topology.service.js';
import { AccountMessage } from './message/account.message.js';

@Module({
  imports: [MessagingModule, TypeOrmModule.forFeature([Transaction, AccountInbox, Account])],
  providers: [AccountRepository, AccountInboxRepository, AccountInboxService, AccountCustomerChargeCommandHandler, AccountCustomerRefundCommandHandler, AccountCreateCommandHandler, AccountUserEventsConsumer, AccountTopologyService, AccountGateway, AccountMessage],
  exports: [AccountCustomerChargeCommandHandler, AccountCustomerRefundCommandHandler],
})
export class AccountModule {}
