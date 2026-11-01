import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { MediaOutbox, type MediaOutboxCreateEntityInterface } from '../entity/media-outbox.entity.js';

@Injectable()
export class MediaOutboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createManyIgnoringExisting(input: MediaOutboxCreateEntityInterface[]): Promise<void> {
    await this.txHost.tx.getRepository(MediaOutbox).createQueryBuilder().insert().values(input).orIgnore().execute();
  }
}
