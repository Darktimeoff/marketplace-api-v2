import { Column } from 'typeorm';
import { CountryCodeEnum } from '@marketplace/contracts-core';

export class LoginPhone {
  @Column({ name: 'loginPhoneCountryCode', type: 'enum', enum: CountryCodeEnum, enumName: 'CountryCodeEnum', nullable: true })
  countryCode: CountryCodeEnum | null;

  @Column({ name: 'loginPhoneRawNumber', type: 'varchar', length: 32, nullable: true })
  rawNumber: string | null;

  @Column({ name: 'loginPhoneFullNumber', type: 'varchar', length: 16, nullable: true })
  fullNumber: string | null;

  @Column({ name: 'loginPhoneNationalNumber', type: 'varchar', length: 15, nullable: true })
  nationalNumber: string | null;
}
