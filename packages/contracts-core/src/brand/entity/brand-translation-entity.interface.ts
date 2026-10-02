import type { LanguageEnum } from '../../generic/enum/language.enum.js';

export interface BrandTranslationEntityInterface {
  id: number;
  brandId: number;
  name: string;
  language: LanguageEnum;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
