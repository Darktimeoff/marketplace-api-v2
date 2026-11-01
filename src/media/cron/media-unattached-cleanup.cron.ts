import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { subHours } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';

@Injectable()
export class MediaUnattachedCleanupCron implements OnModuleInit {
  private readonly logger = new Logger(MediaUnattachedCleanupCron.name);
  private readonly cleanupJobName = 'media-unattached-cleanup';
  private readonly unattachedTtlHours = 24;
  private readonly batchSize = 100;

  constructor(
    private readonly media: MediaRepository,
    private readonly storage: MediaStorageService,
    private readonly maintenance: MaintenanceJobRegistryService,
  ) {}

  onModuleInit(): void {
    this.maintenance.register({
      name: this.cleanupJobName,
      repeat: { pattern: CronExpression.EVERY_HOUR },
      handle: () => this.deleteUnattached(),
    });
  }

  async deleteUnattached(): Promise<void> {
    const createdBefore = subHours(new Date(), this.unattachedTtlHours);
    let deleted = 0;
    let skipped = 0;

    for (;;) {
      const unattached = await this.media.findUnattachedReadyCreatedBefore(createdBefore, this.batchSize);

      for (const media of unattached) {
        if (!(await this.media.markDeletedIfUnattached(media.id))) {
          skipped++;
          continue;
        }

        await this.storage.deleteObject(media.storageKey);
        await this.media.deleteById(media.id);
        deleted++;
      }

      if (unattached.length < this.batchSize) {
        break;
      }
    }

    this.logger.log(`deleted ${deleted} media never attached since before ${createdBefore.toISOString()}, skipped ${skipped} claimed meanwhile`);
  }
}
