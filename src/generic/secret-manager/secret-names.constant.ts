import type { SecretsInterface } from './secrets.interface.js';

const secretNames: Record<keyof SecretsInterface, true> = {
  DBPASSWORD: true,
  DBUSER: true,
  RABBITMQ_USER: true,
  RABBITMQ_PASSWORD: true,
  JWT_PRIVATE_KEY: true,
  JWT_PUBLIC_KEY: true,
  REDIS_CACHE_URL: true,
  REDIS_QUEUE_URL: true,
  REFRESH_TOKEN_PEPPER: true,
};

export const SECRET_NAMES = Object.keys(secretNames) as (keyof SecretsInterface)[];
