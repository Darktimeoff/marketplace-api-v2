import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { EnvironmentService } from '../environment/environment.module.js';

@Injectable()
export class ProxyTrustService implements OnModuleInit {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly environment: EnvironmentService,
  ) {}

  onModuleInit(): void {
    this.adapterHost.httpAdapter.getInstance().set('trust proxy', this.environment.get('TRUST_PROXY_HOPS'));
  }
}
