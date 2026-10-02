import { Column } from 'typeorm';
import { CountryCodeEnum } from '@marketplace/contracts-core';

export class RecipientPhone {
  @Column({ name: 'phoneCountryCode', type: 'enum', enum: CountryCodeEnum, enumName: 'CountryCodeEnum' })
  countryCode: CountryCodeEnum;

  @Column({ name: 'phoneRawNumber', type: 'varchar', length: 32 })
  rawNumber: string;

  @Column({ name: 'phoneFullNumber', type: 'varchar', length: 16 })
  fullNumber: string;

  @Column({ name: 'phoneNationalNumber', type: 'varchar', length: 15 })
  nationalNumber: string;
}
