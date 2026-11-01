import type { MediaKindEnum } from '../../media/enum/media-kind.enum.js';

export interface ProductMediaResponseInterface {
  id: string;
  position: number;
  kind: MediaKindEnum;
  mimeType: string;
  url: string;
}

export interface ProductResponseInterface {
  publicId: string;
  categoryId: number;
  brandId: number;
  media: ProductMediaResponseInterface[];
  createdAt: Date;
}
