import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { BackgroundJob, type BackgroundJobCreateEntityInterface } from '../entity/background-job.entity.js';
import { BackgroundJobStatusEnum, BackgroundJobTypeEnum } from '../../entities/enums.js';

@Injectable()
export class BackgroundJobRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: BackgroundJobCreateEntityInterface): Promise<BackgroundJob> {
    const backgroundJobs = this.txHost.tx.getRepository(BackgroundJob);
    return backgroundJobs.save(backgroundJobs.create(input));
  }

  async claimNext(type: BackgroundJobTypeEnum): Promise<BackgroundJob | null> {
    const rows: BackgroundJob[] = await this.txHost.tx.query(
      `UPDATE "BackgroundJob"
       SET status = $1, "startedAt" = now(), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM "BackgroundJob"
         WHERE status = $2 AND type = $3
         ORDER BY "createdAt" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`,
      [BackgroundJobStatusEnum.PROCESSING, BackgroundJobStatusEnum.QUEUED, type],
    );

    return rows[0] ?? null;
  }

  async markReady(id: BackgroundJob['id']): Promise<void> {
    await this.txHost.tx.getRepository(BackgroundJob).update(id, {
      status: BackgroundJobStatusEnum.READY,
      finishedAt: new Date(),
    });
  }

  async markFailed(id: BackgroundJob['id'], errorMessage: string): Promise<void> {
    await this.txHost.tx.getRepository(BackgroundJob).update(id, {
      status: BackgroundJobStatusEnum.FAILED,
      finishedAt: new Date(),
      errorMessage,
    });
  }
}
