import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';

@Injectable()
export class RedisClientService implements OnModuleInit, OnModuleDestroy {
  cache: Redis;
  queue: Redis;
  private readonly bullConnections: Redis[] = [];

  constructor(private readonly secrets: SecretManagerService) {}

  async onModuleInit(): Promise<void> {
    this.cache = new Redis(await this.secrets.get('REDIS_CACHE_URL'), { lazyConnect: true });
    this.queue = new Redis(await this.secrets.get('REDIS_QUEUE_URL'), { lazyConnect: true });

    await this.cache.connect();
    await this.queue.connect();
  }

  async createBullConnection(): Promise<Redis> {
    const connection = new Redis(await this.secrets.get('REDIS_QUEUE_URL'), { maxRetriesPerRequest: null });
    this.bullConnections.push(connection);
    return connection;
  }

  async onModuleDestroy(): Promise<void> {
    for (const connection of [this.cache, this.queue, ...this.bullConnections]) {
      await connection.quit();
    }
  }
}
