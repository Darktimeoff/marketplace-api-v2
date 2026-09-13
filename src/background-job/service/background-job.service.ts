import { Injectable } from '@nestjs/common';
import { BackgroundJobRepository } from '../repository/background-job.repository.js';
import { BackgroundJobCreateInput } from '../input/background-job-create.input.js';
import { BackgroundJob } from '../entity/background-job.entity.js';

@Injectable()
export class BackgroundJobService {
  constructor(private readonly backgroundJobRepository: BackgroundJobRepository) {}

  /** Ставит задачу в очередь. Статус не принимаем снаружи: новая задача всегда
   *  QUEUED (default колонки), дальше её двигает воркер. */
  create(input: BackgroundJobCreateInput): Promise<BackgroundJob> {
    return this.backgroundJobRepository.create({ ...input, orderId: input.orderId ?? null });
  }
}