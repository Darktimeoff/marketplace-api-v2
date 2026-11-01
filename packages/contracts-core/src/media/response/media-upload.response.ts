import type { MediaResponseInterface } from './media.response.js';

export interface MediaUploadResponseInterface extends MediaResponseInterface {
  url: string | null;
  headers: Record<string, string> | null;
  expiresAt: Date | null;
  partSize: number | null;
  partCount: number | null;
}
