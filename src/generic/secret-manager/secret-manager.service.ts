import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EnvironmentService } from "../environment/environment.module.js";
import { InfisicalSDK } from "@infisical/sdk";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { SecretsInterface } from "./secrets.interface.js";

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
    await this.ready()
  }

  async get(name: keyof SecretsInterface) {
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

  private ready() {
    this.session ??= this.authenticate()
    return this.session
  }

  private async readSecret(name: keyof SecretsInterface) {
    return (await this.client.secrets().getSecret({
      projectId: this.environment.get('INFISICAL_PROJECT_ID'),
      environment: this.environment.get('INFISICAL_ENVIRONMENT'),
      secretName: name
    })).secretValue
  }

  private async authenticate() {
    const clientSecret = (await readFile(this.CLIENT_SECRET_PATH, 'utf-8')).trim()

    await this.client.auth().universalAuth.login({
      clientId: this.environment.get('INFISICAL_CLIENT_ID'),
      clientSecret,
    });
  }
}
