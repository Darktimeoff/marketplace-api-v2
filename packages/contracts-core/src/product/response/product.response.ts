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
  categoryPublicId: string;
  brandPublicId: string;
  media: ProductMediaResponseInterface[];
  createdAt: Date;
}
