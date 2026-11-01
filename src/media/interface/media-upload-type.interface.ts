import type { MediaKindEnum } from '@marketplace/contracts-core';

export interface MediaUploadTypeInterface {
  kind: MediaKindEnum;
  extension: string;
  maxSizeBytes: number;
}
