import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { subHours } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';

@Injectable()
export class MediaOrphanCleanupCron implements OnModuleInit {
  private readonly logger = new Logger(MediaOrphanCleanupCron.name);
  private readonly cleanupJobName = 'media-orphan-cleanup';
  private readonly pendingTtlHours = 24;
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
      handle: () => this.deleteOrphans(),
    });
  }

  async deleteOrphans(): Promise<void> {
    const createdBefore = subHours(new Date(), this.pendingTtlHours);
    let deleted = 0;

    for (;;) {
      const orphans = await this.media.findPendingCreatedBefore(createdBefore, this.batchSize);

      for (const orphan of orphans) {
        if (orphan.uploadId) {
          await this.storage.abortMultipartUpload(orphan.storageKey, orphan.uploadId);
        }

        await this.storage.deleteObject(orphan.storageKey);
        await this.media.deleteById(orphan.id);
        deleted++;
      }

      if (orphans.length < this.batchSize) {
        break;
      }
    }

    this.logger.log(`deleted ${deleted} orphan uploads pending since before ${createdBefore.toISOString()}`);
  }
}
