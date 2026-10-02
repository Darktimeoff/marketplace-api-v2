import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, MoreThan } from 'typeorm';
import {
  IdentitySession,
  type IdentitySessionConsumedInterface,
  type IdentitySessionCreateEntityInterface,
} from '../entity/identity-session.entity.js';

@Injectable()
export class IdentitySessionRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: IdentitySessionCreateEntityInterface): Promise<IdentitySession> {
    const sessions = this.txHost.tx.getRepository(IdentitySession);
    return sessions.save(sessions.create(input));
  }

  async consume(tokenHash: IdentitySession['tokenHash']): Promise<IdentitySessionConsumedInterface | null> {
    const result = await this.txHost.tx
      .getRepository(IdentitySession)
      .createQueryBuilder()
      .update()
      .set({ usedAt: () => 'now()' })
      .where({ tokenHash, usedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(new Date()) })
      .returning(['identityId', 'familyId'])
      .execute();
    const [consumed]: IdentitySessionConsumedInterface[] = result.raw;

    return consumed ?? null;
  }

  findByTokenHash(tokenHash: IdentitySession['tokenHash']): Promise<IdentitySession | null> {
    return this.txHost.tx.getRepository(IdentitySession).findOne({ where: { tokenHash } });
  }

  async revokeFamily(familyId: IdentitySession['familyId']): Promise<void> {
    await this.txHost.tx.getRepository(IdentitySession).update({ familyId, revokedAt: IsNull() }, { revokedAt: () => 'now()' });
  }
}
