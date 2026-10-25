import type { EnvironmentType } from '../../generic/environment/environment.schema.js';
import type { SecretsInterface } from '../../generic/secret-manager/secrets.interface.js';

type StringEnvironmentKeyType = { [K in keyof EnvironmentType]: EnvironmentType[K] extends string ? K : never }[keyof EnvironmentType];

export interface OidcProviderConfigInterface {
  issuerVariable: StringEnvironmentKeyType;
  clientIdVariable: StringEnvironmentKeyType;
  clientSecretName: keyof SecretsInterface;
  scope: string;
}
