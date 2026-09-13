import { Injectable } from '@nestjs/common';
import { BackgroundJobRepository } from '../repository/background-job.repository.js';
import { BackgroundJobCreateInput } from '../input/background-job-create.input.js';
import { BackgroundJob } from '../entity/background-job.entity.js';
import { BackgroundJobTypeEnum } from '../../entities/enums.js';

@Injectable()
export class BackgroundJobService {
  constructor(private readonly backgroundJobRepository: BackgroundJobRepository) {}

  create(input: BackgroundJobCreateInput): Promise<BackgroundJob> {
    return this.backgroundJobRepository.create({ ...input, orderId: input.orderId ?? null });
  }

  claimNext(type: BackgroundJobTypeEnum): Promise<BackgroundJob | null> {
    return this.backgroundJobRepository.claimNext(type);
  }

  markReady(id: BackgroundJob['id']): Promise<void> {
    return this.backgroundJobRepository.markReady(id);
  }

  markFailed(id: BackgroundJob['id'], errorMessage: string): Promise<void> {
    return this.backgroundJobRepository.markFailed(id, errorMessage);
  }
}
