import type { MediaKindEnum } from '@marketplace/contracts-core';
import type { MediaEncodedInterface } from './media-encoded.interface.js';

export interface MediaVariantEncoderInterface {
  readonly kind: MediaKindEnum;
  encode(sourcePath: string, outputDir: string): Promise<MediaEncodedInterface>;
}
