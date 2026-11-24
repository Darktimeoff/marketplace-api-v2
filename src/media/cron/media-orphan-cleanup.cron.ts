import { Injectable, OnModuleInit } from '@nestjs/common';
import { Log } from '../../generic/logging/decorator/log.decorator.js';
import { CronExpression } from '@nestjs/schedule';
import { subHours } from 'date-fns';
import { MaintenanceJobRegistryService } from '../../generic/queue/maintenance-job-registry.service.js';
import { MediaRepository } from '../repository/media.repository.js';
import { MediaStorageService } from '../service/media-storage.service.js';

@Injectable()
export class MediaOrphanCleanupCron implements OnModuleInit {
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

  @Log(undefined, ({ deleted, createdBefore }) => `deleted ${deleted} orphan uploads pending since before ${createdBefore.toISOString()}`)
  async deleteOrphans(): Promise<{ deleted: number; createdBefore: Date }> {
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

    return { deleted, createdBefore };
  }
}
