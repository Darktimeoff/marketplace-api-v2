export const VAULT_SECRET_NAMES = [
  'DBPASSWORD',
  'DBUSER',
  'RABBITMQ_USER',
  'RABBITMQ_PASSWORD',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'REDIS_PASSWORD',
  'REFRESH_TOKEN_PEPPER',
  'GOOGLE_CLIENT_SECRET',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
] as const;

export const VAULT_VARIABLE_NAMES = [...VAULT_SECRET_NAMES, 'PULUMI_CONFIG_PASSPHRASE'] as const;

export const POD_VAULT_VARIABLE_NAMES = [
  'INFISICAL_PROJECT_ID',
  'INFISICAL_ENVIRONMENT',
  'PULUMI_CONFIG_PASSPHRASE',
] as const;

export type VaultSecretNameType = (typeof VAULT_SECRET_NAMES)[number];

export type VaultSecretsType = Record<VaultSecretNameType, string>;

export function missingVaultVariables(environment: NodeJS.ProcessEnv): string[] {
  return VAULT_VARIABLE_NAMES.filter((name) => !environment[name]?.trim());
}

export function pickVaultSecrets(environment: NodeJS.ProcessEnv): VaultSecretsType {
  return Object.fromEntries(VAULT_SECRET_NAMES.map((name) => [name, environment[name] ?? ''])) as VaultSecretsType;
}

export function missingPodVaultVariables(environment: NodeJS.ProcessEnv): string[] {
  return POD_VAULT_VARIABLE_NAMES.filter((name) => !environment[name]?.trim());
}
