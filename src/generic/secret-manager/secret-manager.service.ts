import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvironmentService } from "../environment/environment.module.js";
import { InfisicalSDK } from "@infisical/sdk";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { CloudSecretsInterface, SecretsInterface } from "./secrets.interface.js";

const SKIP_VAULT = process.env.SKIP_VAULT === '1';

@Injectable()
export class SecretManagerService implements OnModuleInit {
  private readonly CLIENT_SECRET_PATH = join(process.cwd(), 'secrets', 'infisical_client_secret.txt');
  private readonly client: InfisicalSDK
  private readonly logger = new Logger(SecretManagerService.name)
  private session: Promise<void> | null = null

  constructor(private readonly environment: EnvironmentService) {
    this.client = new InfisicalSDK({ siteUrl: this.environment.get('INFISICAL_SITE_URL') });
  }

  async onModuleInit() {
    if (SKIP_VAULT) {
      this.logger.warn('SKIP_VAULT=1 — секреты читаются из окружения, хранилище не опрашивается')
      return
    }

    await this.ready()
  }

  async get(name: keyof SecretsInterface | keyof CloudSecretsInterface) {
    if (SKIP_VAULT) {
      return this.fromEnvironmentOrFail(name)
    }

    await this.ready()

    try {
      return await this.readSecret(name)
    } catch (e) {
      this.logger.error(`Error reading "${name}" from Infisical, re-authenticating and retrying once`, e)

      this.session = null
      await this.ready()

      return await this.readSecret(name)
    }
  }

  private fromEnvironmentOrFail(name: keyof SecretsInterface | keyof CloudSecretsInterface): string {
    const value = process.env[name]

    if (!value) {
      throw new Error(
        `${name} is not set. При SKIP_VAULT=1 секреты берутся из окружения — ` +
          `выставь ${name} вручную (см. README, раздел Secrets).`,
      )
    }

    return value
  }

  private ready() {
    this.session ??= this.authenticate()
    return this.session
  }

  private async readSecret(name: keyof SecretsInterface | keyof CloudSecretsInterface) {
    return (await this.client.secrets().getSecret({
      projectId: this.environment.get('INFISICAL_PROJECT_ID'),
      environment: this.environment.get('INFISICAL_ENVIRONMENT'),
      secretName: name
    })).secretValue
  }

  private async authenticate() {
    if (this.environment.get('INFISICAL_AUTH_METHOD') === 'jwt') {
      this.client.auth().accessToken(await this.loginWithServiceAccountToken())
      return
    }

    const clientId = this.environment.get('INFISICAL_CLIENT_ID')

    if (!clientId) {
      throw new Error('INFISICAL_CLIENT_ID is required with INFISICAL_AUTH_METHOD=universal')
    }

    const clientSecret = (await readFile(this.CLIENT_SECRET_PATH, 'utf-8')).trim()

    await this.client.auth().universalAuth.login({
      clientId,
      clientSecret,
    });
  }

  private async loginWithServiceAccountToken(): Promise<string> {
    const identityId = this.environment.get('INFISICAL_IDENTITY_ID')

    if (!identityId) {
      throw new Error('INFISICAL_IDENTITY_ID is required with INFISICAL_AUTH_METHOD=jwt')
    }

    const jwt = (await readFile(this.environment.get('INFISICAL_JWT_PATH'), 'utf-8')).trim()
    const response = await fetch(`${this.environment.get('INFISICAL_SITE_URL')}/api/v1/auth/jwt-auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identityId, jwt }),
    })

    if (!response.ok) {
      throw new Error(`Infisical JWT login answered ${response.status}: ${(await response.text()).slice(0, 200)}`)
    }

    const { accessToken } = await response.json() as { accessToken: string }
    this.logger.log(`Logged in to Infisical as identity ${identityId} with the ServiceAccount token`)

    return accessToken
  }
}
