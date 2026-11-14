export interface SecretsInterface {
  DBPASSWORD: string
  DBUSER: string
  RABBITMQ_USER: string
  RABBITMQ_PASSWORD: string
  JWT_PRIVATE_KEY: string
  JWT_PUBLIC_KEY: string
  REDIS_PASSWORD: string
  REFRESH_TOKEN_PEPPER: string
  GOOGLE_CLIENT_SECRET: string
  STORAGE_ACCESS_KEY: string
  STORAGE_SECRET_KEY: string
}

export interface CloudSecretsInterface {
  KAFKA_SASL_USERNAME: string
  KAFKA_SASL_PASSWORD: string
  TEMPORAL_API_KEY: string
}
