import type { MediaResponseInterface } from './media.response.js';

export interface MediaUploadResponseInterface extends MediaResponseInterface {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}
