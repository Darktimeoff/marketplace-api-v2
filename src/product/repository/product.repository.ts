import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { LanguageEnum } from '../../entities/enums.js';
import type {
  CategoryBreadcrumbInterface,
  ProductCoreRowInterface,
  ProductOfferSummaryInterface,
} from '../interface/product-detail.interface.js';

@Injectable()
export class ProductRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  async findCoreById(
    id: number,
    language: LanguageEnum,
  ): Promise<ProductCoreRowInterface | null> {
    const rows: ProductCoreRowInterface[] = await this.txHost.tx.query(
      `SELECT p.id,
              p."categoryId" AS "categoryId",
              pt.title,
              p.slug,
              b.slug AS "brandSlug",
              bt.name AS "brandName"
         FROM "Product" p
         JOIN "ProductTranslation" pt
           ON pt."productId" = p.id AND pt.language = $2 AND pt."deletedAt" IS NULL
    LEFT JOIN "Brand" b ON b.id = p."brandId" AND b."deletedAt" IS NULL
    LEFT JOIN "BrandTranslation" bt
           ON bt."brandId" = b.id AND bt.language = $2 AND bt."deletedAt" IS NULL
        WHERE p.id = $1 AND p."deletedAt" IS NULL`,
      [id, language],
    );

    return rows[0] ?? null;
  }

  findOffersByProductId(
    productId: number,
  ): Promise<ProductOfferSummaryInterface[]> {
    return this.txHost.tx.query(
      `SELECT "sellerId" AS "sellerId",
              price,
              "discountPrice" AS "discountPrice",
              currency,
              quantity
         FROM "ProductOffer"
        WHERE "productId" = $1 AND "deletedAt" IS NULL
     ORDER BY id ASC`,
      [productId],
    );
  }

  findCategoryBreadcrumbs(
    categoryId: number,
    language: LanguageEnum,
  ): Promise<CategoryBreadcrumbInterface[]> {
    return this.txHost.tx.query(
      `WITH RECURSIVE breadcrumb AS (
         SELECT id, slug, "parentCategoryId", 0 AS depth
           FROM "Category"
          WHERE id = $1 AND "deletedAt" IS NULL
         UNION ALL
         SELECT c.id, c.slug, c."parentCategoryId", b.depth + 1
           FROM "Category" c
           JOIN breadcrumb b ON c.id = b."parentCategoryId"
          WHERE c."deletedAt" IS NULL
       )
       SELECT b.id, b.slug, ct.name
         FROM breadcrumb b
         JOIN "CategoryTranslation" ct
           ON ct."categoryId" = b.id AND ct.language = $2 AND ct."deletedAt" IS NULL
     ORDER BY b.depth DESC`,
      [categoryId, language],
    );
  }
}
