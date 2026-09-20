import { CurrencyEnum } from '../../entities/enums.js';

export interface ProductOfferSummaryInterface {
  sellerId: number;
  price: string;
  discountPrice: string | null;
  currency: CurrencyEnum;
  quantity: number;
}

export interface ProductBrandSummaryInterface {
  name: string;
  slug: string;
}

export interface ProductDetailInterface {
  title: string;
  slug: string;
  brand: ProductBrandSummaryInterface | null;
  offers: ProductOfferSummaryInterface[];
}

export interface CategoryBreadcrumbInterface {
  id: number;
  slug: string;
  name: string;
}

export interface ProductDetailResultInterface {
  product: ProductDetailInterface;
  breadcrumbs: CategoryBreadcrumbInterface[];
}

export interface ProductCoreRowInterface {
  id: number;
  categoryId: number;
  title: string;
  slug: string;
  brandSlug: string | null;
  brandName: string | null;
}
