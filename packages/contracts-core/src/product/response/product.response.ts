import type { MediaKindEnum } from '../../media/enum/media-kind.enum.js';
import type { MediaVariantNameEnum } from '../../media/enum/media-variant-name.enum.js';

export interface ProductMediaVariantResponseInterface {
  name: MediaVariantNameEnum;
  mimeType: string;
  url: string;
  width: number;
  height: number;
}

export interface ProductMediaResponseInterface {
  id: string;
  position: number;
  kind: MediaKindEnum;
  mimeType: string;
  url: string;
  thumbHash: string | null;
  variants: ProductMediaVariantResponseInterface[];
}

export interface ProductResponseInterface {
  publicId: string;
  categoryPublicId: string;
  brandPublicId: string;
  media: ProductMediaResponseInterface[];
  createdAt: Date;
}
