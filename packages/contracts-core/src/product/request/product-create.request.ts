import type { LanguageEnum } from '../../generic/enum/language.enum.js';

export interface ProductCreateTranslationRequestInterface {
  language: LanguageEnum;
  title: string;
  description?: string | null;
}

export interface ProductCreateRequestInterface {
  categoryPublicId: string;
  brandPublicId: string;
  translations: ProductCreateTranslationRequestInterface[];
  mediaIds?: string[];
}
