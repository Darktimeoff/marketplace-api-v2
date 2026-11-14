import { Injectable, OnModuleInit } from '@nestjs/common';
import { Log } from '../../generic/decorator/log.decorator.js';
import { CronExpression } from '@nestjs/schedule';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaRepository } from '../repository/media.repository.js';

@Injectable()
export class MediaClaimReleaseCron implements OnModuleInit {
  private readonly releaseJobName = 'media-claim-release';

  constructor(
    private readonly media: MediaRepository,
    private readonly maintenance: MaintenanceJobRegistryService,
  ) {}

  onModuleInit(): void {
    this.maintenance.register({
      name: this.releaseJobName,
      repeat: { pattern: CronExpression.EVERY_5_MINUTES },
      handle: () => this.releaseExpired(),
    });
  }

  @Log(undefined, released => `released ${released} expired media claims`)
  async releaseExpired(): Promise<number> {
    return this.media.releaseExpiredClaims();
  }
}
