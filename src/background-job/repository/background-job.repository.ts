import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { BackgroundJob, type BackgroundJobCreateEntityInterface } from '../entity/background-job.entity.js';

@Injectable()
export class BackgroundJobRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: BackgroundJobCreateEntityInterface): Promise<BackgroundJob> {
    const backgroundJobs = this.txHost.tx.getRepository(BackgroundJob);
    return backgroundJobs.save(backgroundJobs.create(input));
  }
}