import { CurrencyEnum } from '../../generic/enum/enums.js';

export interface SellerOfferSummaryInterface {
  sellerId: number;
  price: string;
  discountPrice: string | null;
  currency: CurrencyEnum;
  quantity: number;
}

export interface ProductVariantSummaryInterface {
  id: number;
  sku: string;
  slug: string;
  barcode: string | null;
  offers: SellerOfferSummaryInterface[];
}

export interface ProductBrandSummaryInterface {
  name: string;
  slug: string;
}

export interface ProductDetailInterface {
  title: string;
  brand: ProductBrandSummaryInterface | null;
  variants: ProductVariantSummaryInterface[];
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
  brandSlug: string | null;
  brandName: string | null;
}

export interface ProductVariantRowInterface {
  id: number;
  sku: string;
  slug: string;
  barcode: string | null;
}

export interface SellerOfferRowInterface extends SellerOfferSummaryInterface {
  variantId: number;
}
