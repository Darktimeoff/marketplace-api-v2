import type { LanguageEnum } from '../../generic/enum/language.enum.js';

export interface ProductTranslationEntityInterface {
  id: number;
  productId: number;
  title: string;
  description: string | null;
  language: LanguageEnum;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
