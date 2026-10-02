import type { LanguageEnum } from '../../generic/enum/language.enum.js';

export interface CategoryTranslationEntityInterface {
  id: number;
  categoryId: number;
  name: string;
  language: LanguageEnum;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
