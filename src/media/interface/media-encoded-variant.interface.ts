import type { MediaVariantNameEnum } from '@marketplace/contracts-core';

export interface MediaEncodedVariantInterface {
  name: MediaVariantNameEnum;
  mimeType: string;
  extension: string;
  path: string;
  width: number;
  height: number;
  sizeBytes: number;
}
