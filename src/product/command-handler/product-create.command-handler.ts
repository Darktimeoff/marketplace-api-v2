import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { QueryFailedError } from 'typeorm';
import { ProductRepository } from '../repository/product.repository.js';
import { ProductTranslationRepository } from '../repository/product-translation.repository.js';
import { ProductCreateInput } from '../input/product-create.input.js';
import { Product } from '../entity/product.entity.js';

@Injectable()
export class ProductCreateCommandHandler {
  private readonly foreignKeyViolation = '23503';

  constructor(
    private readonly products: ProductRepository,
    private readonly translations: ProductTranslationRepository,
  ) {}

  async execute(input: ProductCreateInput): Promise<Product> {
    try {
      return await this.create(input);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === this.foreignKeyViolation) {
        throw new NotFoundException('Category or brand not found');
      }

      throw error;
    }
  }

  @Transactional()
  private async create(input: ProductCreateInput): Promise<Product> {
    const product = await this.products.create({ categoryId: input.categoryId, brandId: input.brandId });
    await this.translations.create(
      input.translations.map(({ language, title, description }) => ({ productId: product.id, language, title, description: description ?? null })),
    );
    return product;
  }
}
