// Значения совпадают с CREATE TYPE из db/schema.sql (ДЗ #12).
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
