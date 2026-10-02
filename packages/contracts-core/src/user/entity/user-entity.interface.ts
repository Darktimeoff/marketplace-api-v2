import type { GenderEnum } from '../enum/gender.enum.js';
import type { LanguageEnum } from '../../generic/enum/language.enum.js';

export interface UserEntityInterface {
  id: number;
  identityId: number;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  gender: GenderEnum | null;
  language: LanguageEnum;
  timezone: string;
  deliveryAddressId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
