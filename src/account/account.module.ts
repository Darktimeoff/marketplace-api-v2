import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entity/transaction.entity.js';
import { AccountRepository } from './repository/account.repository.js';
import { AccountGateway } from './gateway/account.gateway.js';
import { AccountTopology } from './service/account-topology.service.js';
import { AccountCustomerChargeCommandHandler } from './command-handler/account-customer-charge.command-handler.js';
import { RabbitMqModule } from '../generic/rabbitmq/rabbitmq.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), RabbitMqModule],
  providers: [AccountRepository, AccountCustomerChargeCommandHandler, AccountTopology, AccountGateway],
})
export class AccountModule {}
