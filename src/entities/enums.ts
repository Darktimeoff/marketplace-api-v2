// Значения совпадают с CREATE TYPE из исходной raw-SQL схемы ДЗ #12 (см. marketplace.dbml).
// enumName обязателен: без него TypeORM создал бы свои типы вида "User_language_enum"
// вместо существующих "LanguageEnum" и т.д.

export enum LanguageEnum {
  en = 'en',
  ua = 'ua',
}

export enum RoleEnum {
  owner = 'owner',
  seller = 'seller',
  admin = 'admin',
  user = 'user',
}

export enum GenderEnum {
  male = 'male',
  female = 'female',
}

export enum CountryCodeEnum {
  UA = 'UA',
  US = 'US',
  PL = 'PL',
  DE = 'DE',
  GB = 'GB',
}

export enum CurrencyEnum {
  UAH = 'UAH',
  EUR = 'EUR',
  USD = 'USD',
}

export enum StatusEnum {
  created = 'created',
  pending_payment = 'pending_payment',
  failed_payment = 'failed_payment',
  paid = 'paid',
  confirmed = 'confirmed',
  preparing = 'preparing',
  shipped = 'shipped',
  delivered = 'delivered',
  completed = 'completed',
  canceled = 'canceled',
  refunded = 'refunded',
}

// Направление денег кодирует TransactionType; amount у Transaction — всегда
// неотрицательная величина (тот же домен "amount", что и у денег в остальной схеме).
export enum TransactionTypeEnum {
  DEPOSIT = 'DEPOSIT',
  PAYMENT = 'PAYMENT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatusEnum {
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  SUCCESS = 'SUCCESS',
}

export enum BackgroundJobTypeEnum {
  ORDER = 'ORDER',
}

export enum BackgroundJobStatusEnum {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  INTERRUPTED = 'INTERRUPTED',
}
