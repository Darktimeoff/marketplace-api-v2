import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { LanguageEnum, type ProductCreateRequestInterface, type ProductCreateTranslationRequestInterface } from '@marketplace/contracts-core';

export class ProductCreateTranslationInput implements ProductCreateTranslationRequestInterface {
  @IsEnum(LanguageEnum)
  language: LanguageEnum;

  @IsString()
  @MaxLength(255)
  @Matches(/\S/, { message: 'title must not be blank' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class ProductCreateInput implements ProductCreateRequestInterface {
  @IsInt()
  @IsPositive()
  categoryId: number;

  @IsInt()
  @IsPositive()
  brandId: number;

  @ArrayNotEmpty()
  @ArrayUnique((translation: ProductCreateTranslationInput) => translation.language)
  @ValidateNested({ each: true })
  @Type(() => ProductCreateTranslationInput)
  translations: ProductCreateTranslationInput[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}
