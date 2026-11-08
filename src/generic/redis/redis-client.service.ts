import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';

@Injectable()
export class RedisClientService implements OnModuleInit, OnModuleDestroy {
  cache: Redis;
  queue: Redis;
  private readonly bullConnections: Redis[] = [];

  constructor(
    private readonly secrets: SecretManagerService,
    private readonly environment: EnvironmentService,
  ) {}

  async onModuleInit(): Promise<void> {
    const password = await this.secrets.get('REDIS_PASSWORD');

    this.cache = new Redis({ host: this.environment.get('REDIS_CACHE_HOST'), port: this.environment.get('REDIS_CACHE_PORT'), password, lazyConnect: true });
    this.queue = new Redis({ host: this.environment.get('REDIS_QUEUE_HOST'), port: this.environment.get('REDIS_QUEUE_PORT'), password, lazyConnect: true });

    await this.cache.connect();
    await this.queue.connect();
  }

  async createBullConnection(): Promise<Redis> {
    const connection = new Redis({
      host: this.environment.get('REDIS_QUEUE_HOST'),
      port: this.environment.get('REDIS_QUEUE_PORT'),
      password: await this.secrets.get('REDIS_PASSWORD'),
      maxRetriesPerRequest: null,
    });
    this.bullConnections.push(connection);
    return connection;
  }

  async onModuleDestroy(): Promise<void> {
    for (const connection of [this.cache, this.queue, ...this.bullConnections]) {
      await connection.quit();
    }
  }
}
