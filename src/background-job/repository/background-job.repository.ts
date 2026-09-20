import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In } from 'typeorm';
import { BackgroundJob, type BackgroundJobCreateEntityInterface } from '../entity/background-job.entity.js';
import { BackgroundJobStatusEnum, BackgroundJobTypeEnum } from '../../generic/enum/enums.js';

export interface QueueDepthInterface {
  queued: number;
  processing: number;
}

@Injectable()
export class BackgroundJobRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: BackgroundJobCreateEntityInterface): Promise<BackgroundJob> {
    const backgroundJobs = this.txHost.tx.getRepository(BackgroundJob);
    return backgroundJobs.save(backgroundJobs.create(input));
  }

  createMany(inputs: BackgroundJobCreateEntityInterface[]): Promise<BackgroundJob[]> {
    const backgroundJobs = this.txHost.tx.getRepository(BackgroundJob);
    return backgroundJobs.save(inputs.map((input) => backgroundJobs.create(input)));
  }

  async claimNext(
    type: BackgroundJobTypeEnum,
    workerId: string,
  ): Promise<BackgroundJob | null> {
    const jobs = this.txHost.tx.getRepository(BackgroundJob);

    const candidate = await jobs
      .createQueryBuilder('job')
      .select('job.id', 'id')
      .where('job.type = :type', { type })
      .andWhere('job.status = :status', { status: BackgroundJobStatusEnum.QUEUED })
      .andWhere('job.deletedAt IS NULL')
      .orderBy('job.createdAt', 'ASC')
      .addOrderBy('job.id', 'ASC')
      .limit(1)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getRawOne<{ id: number }>();

    if (!candidate) {
      return null;
    }

    const [rows]: [BackgroundJob[], number] = await this.txHost.tx.query(
      `UPDATE "BackgroundJob"
          SET "status" = $2,
              "startedAt" = now(),
              "attempts" = "attempts" + 1,
              "processedBy" = $3
        WHERE "id" = $1
    RETURNING *`,
      [candidate.id, BackgroundJobStatusEnum.PROCESSING, workerId],
    );

    return rows[0] ?? null;
  }

  async markReady(
    id: BackgroundJob['id'],
    workerId: string,
    result: Record<string, unknown> = {},
  ): Promise<void> {
    await this.txHost.tx.query(
      `UPDATE "BackgroundJob"
          SET "status" = $2,
              "finishedAt" = now(),
              "processedCount" = "processedCount" + 1,
              "processedBy" = $3,
              "payload" = "payload" || $4::jsonb
        WHERE "id" = $1`,
      [id, BackgroundJobStatusEnum.READY, workerId, JSON.stringify(result)],
    );
  }

  async markFailed(id: BackgroundJob['id'], errorMessage: string): Promise<void> {
    await this.txHost.tx.getRepository(BackgroundJob).update(id, {
      status: BackgroundJobStatusEnum.FAILED,
      finishedAt: new Date(),
      errorMessage,
    });
  }

  async countPending(type: BackgroundJobTypeEnum): Promise<QueueDepthInterface> {
    const row = await this.txHost.tx
      .getRepository(BackgroundJob)
      .createQueryBuilder('job')
      .select(
        `count(*) FILTER (WHERE job.status = :queued)::int`,
        'queued',
      )
      .addSelect(`count(*) FILTER (WHERE job.status = :processing)::int`, 'processing')
      .where('job.type = :type', { type })
      .andWhere('job.deletedAt IS NULL')
      .setParameters({
        queued: BackgroundJobStatusEnum.QUEUED,
        processing: BackgroundJobStatusEnum.PROCESSING,
      })
      .getRawOne<QueueDepthInterface>();

    return row ?? { queued: 0, processing: 0 };
  }

  findByIds(ids: BackgroundJob['id'][]): Promise<BackgroundJob[]> {
    return this.txHost.tx.getRepository(BackgroundJob).findBy({ id: In(ids) });
  }

  async deleteByDedupeKeyPrefix(prefix: string): Promise<number> {
    const [, affected]: [unknown, number] = await this.txHost.tx.query(
      `DELETE FROM "BackgroundJob" WHERE "dedupeKey" LIKE $1`,
      [`${prefix}%`],
    );

    return affected;
  }
}
