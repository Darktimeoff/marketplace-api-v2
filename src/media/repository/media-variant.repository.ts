import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { MediaVariant, type MediaVariantCreateEntityInterface } from '../entity/media-variant.entity.js';

@Injectable()
export class MediaVariantRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  existsForMedia(mediaId: MediaVariant['mediaId']): Promise<boolean> {
    return this.txHost.tx.getRepository(MediaVariant).existsBy({ mediaId });
  }

  async createManyIgnoringExisting(input: MediaVariantCreateEntityInterface[]): Promise<void> {
    await this.txHost.tx.getRepository(MediaVariant).createQueryBuilder().insert().values(input).orIgnore().execute();
  }
}
