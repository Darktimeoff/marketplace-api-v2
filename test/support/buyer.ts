import type { INestApplicationContext } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { Identity } from '../../src/identity/entity/identity.entity.js';
import { OrderBuyer } from '../../src/order/entity/order-buyer.entity.js';
import { TokenService } from '../../src/identity/service/token.service.js';
import { RoleEnum } from '../../src/identity/enum/role.enum.js';
import { aUser } from './builders.js';

export interface TestBuyerInterface {
  id: number;
  identityPublicId: string;
  token: string;
}

export async function aBuyer(app: INestApplicationContext, dataSource: DataSource, role: RoleEnum = RoleEnum.user): Promise<TestBuyerInterface> {
  const user = await aUser(dataSource.manager);
  await dataSource.getRepository(OrderBuyer).insert({ identityPublicId: user.identityPublicId, userId: user.id });
  await dataSource.getRepository(Identity).update({ id: user.identityId }, { role });
  const identity = await dataSource.getRepository(Identity).findOneByOrFail({ id: user.identityId });
  const { accessToken } = await app.get(TokenService).createTokenPair(identity);

  return { id: user.id, identityPublicId: user.identityPublicId, token: accessToken };
}
