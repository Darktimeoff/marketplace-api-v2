import { Injectable } from '@nestjs/common';
import {
  BackgroundJobRepository,
  type QueueDepthInterface,
} from '../repository/background-job.repository.js';
import { BackgroundJobCreateInput } from '../input/background-job-create.input.js';
import { BackgroundJob } from '../entity/background-job.entity.js';
import { BackgroundJobTypeEnum } from '../../entities/enums.js';

@Injectable()
export class BackgroundJobService {
  constructor(private readonly backgroundJobRepository: BackgroundJobRepository) {}

  create(input: BackgroundJobCreateInput): Promise<BackgroundJob> {
    return this.backgroundJobRepository.create({ ...input, orderId: input.orderId ?? null });
  }

  createMany(inputs: BackgroundJobCreateInput[]): Promise<BackgroundJob[]> {
    return this.backgroundJobRepository.createMany(
      inputs.map((input) => ({ ...input, orderId: input.orderId ?? null })),
    );
  }

  claimNext(type: BackgroundJobTypeEnum, workerId: string): Promise<BackgroundJob | null> {
    return this.backgroundJobRepository.claimNext(type, workerId);
  }

  markReady(
    id: BackgroundJob['id'],
    workerId: string,
    result?: Record<string, unknown>,
  ): Promise<void> {
    return this.backgroundJobRepository.markReady(id, workerId, result);
  }

  markFailed(id: BackgroundJob['id'], errorMessage: string): Promise<void> {
    return this.backgroundJobRepository.markFailed(id, errorMessage);
  }

  countPending(type: BackgroundJobTypeEnum): Promise<QueueDepthInterface> {
    return this.backgroundJobRepository.countPending(type);
  }

  findByIds(ids: BackgroundJob['id'][]): Promise<BackgroundJob[]> {
    return this.backgroundJobRepository.findByIds(ids);
  }

  deleteByDedupeKeyPrefix(prefix: string): Promise<number> {
    return this.backgroundJobRepository.deleteByDedupeKeyPrefix(prefix);
  }
}
