import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvironmentService } from '../environment/environment.module.js';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { getTlsOptions } from '../tls/util/get-tls-options.util.js';

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

    this.cache = new Redis({ host: this.environment.get('REDIS_CACHE_HOST'), port: this.environment.get('REDIS_CACHE_PORT'), password, tls: this.tlsFor(this.environment.get('REDIS_CACHE_HOST')), lazyConnect: true });
    this.queue = new Redis({ host: this.environment.get('REDIS_QUEUE_HOST'), port: this.environment.get('REDIS_QUEUE_PORT'), password, tls: this.tlsFor(this.environment.get('REDIS_QUEUE_HOST')), lazyConnect: true });

    await this.cache.connect();
    await this.queue.connect();
  }

  async createBullConnection(): Promise<Redis> {
    const connection = new Redis({
      host: this.environment.get('REDIS_QUEUE_HOST'),
      port: this.environment.get('REDIS_QUEUE_PORT'),
      password: await this.secrets.get('REDIS_PASSWORD'),
      tls: this.tlsFor(this.environment.get('REDIS_QUEUE_HOST')),
      maxRetriesPerRequest: null,
    });
    this.bullConnections.push(connection);
    return connection;
  }

  private tlsFor(host: string) {
    return getTlsOptions(this.environment.get('TLS_MODE'), this.environment.get('TLS_CA_PATH'), host) || undefined;
  }

  async onModuleDestroy(): Promise<void> {
    for (const connection of [this.cache, this.queue, ...this.bullConnections]) {
      await connection.quit();
    }
  }
}
