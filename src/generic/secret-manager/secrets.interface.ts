export interface SecretsInterface {
  DBPASSWORD: string
  DBUSER: string
  RABBITMQ_USER: string
  RABBITMQ_PASSWORD: string
  JWT_PRIVATE_KEY: string
  JWT_PUBLIC_KEY: string
  REDIS_CACHE_URL: string
  REDIS_QUEUE_URL: string
  REFRESH_TOKEN_PEPPER: string
}