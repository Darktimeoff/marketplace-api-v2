import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { calculateJwkThumbprint, createLocalJWKSet, exportJWK, importSPKI, type JWK, type JWTVerifyGetKey } from 'jose';
import { SecretManagerService } from '../secret-manager/secret-manager.service.js';
import { ACCESS_TOKEN_ALGORITHM } from './constant/access-token.constant.js';

@Injectable()
export class JwtVerificationKeysService implements OnModuleInit {
  private readonly logger = new Logger(JwtVerificationKeysService.name);
  private readonly pemBlockPattern = /-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/g;
  private keySet: JWTVerifyGetKey;
  private loadedKids: string[] = [];

  constructor(private readonly secrets: SecretManagerService) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  @Interval(60_000)
  async refresh(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      this.logger.error(`jwt verification keys not refreshed, keeping kids=[${this.loadedKids.join(', ')}]: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  get getKey(): JWTVerifyGetKey {
    return this.keySet;
  }

  get kids(): string[] {
    return this.loadedKids;
  }

  private async load(): Promise<void> {
    const blocks = (await this.secrets.get('JWT_PUBLIC_KEY')).match(this.pemBlockPattern) ?? [];

    if (blocks.length === 0) {
      throw new Error('JWT_PUBLIC_KEY holds no PEM public key');
    }

    const keys: JWK[] = [];
    for (const block of blocks) {
      const jwk = await exportJWK(await importSPKI(block, ACCESS_TOKEN_ALGORITHM, { extractable: true }));
      keys.push({ ...jwk, kid: await calculateJwkThumbprint(jwk), alg: ACCESS_TOKEN_ALGORITHM, use: 'sig' });
    }

    const kids = keys.map(({ kid }) => kid as string);
    this.keySet = createLocalJWKSet({ keys });

    if (kids.join() !== this.loadedKids.join()) {
      this.loadedKids = kids;
      this.logger.log(`jwt verification keys: [${kids.join(', ')}]`);
    }
  }
}
