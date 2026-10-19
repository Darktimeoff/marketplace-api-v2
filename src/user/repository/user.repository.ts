import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { User, type UserCreateEntityInterface } from '../entity/user.entity.js';

@Injectable()
export class UserRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createIfAbsent(input: UserCreateEntityInterface): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(User)
      .createQueryBuilder()
      .insert()
      .values(input)
      .orIgnore()
      .returning(['id'])
      .execute();

    return result.raw.length > 0;
  }

  findByIdentityIdOrFail(identityId: User['identityId']): Promise<User> {
    return this.txHost.tx.getRepository(User).findOneOrFail({ where: { identityId } });
  }
}
