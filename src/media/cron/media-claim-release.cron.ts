import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaRepository } from '../repository/media.repository.js';

@Injectable()
export class MediaClaimReleaseCron implements OnModuleInit {
  private readonly logger = new Logger(MediaClaimReleaseCron.name);
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

  async releaseExpired(): Promise<void> {
    const released = await this.media.releaseExpiredClaims();
    this.logger.log(`released ${released} expired media claims`);
  }
}
