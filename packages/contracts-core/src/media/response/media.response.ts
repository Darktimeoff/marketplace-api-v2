import type { MediaKindEnum } from '../enum/media-kind.enum.js';
import type { MediaStatusEnum } from '../enum/media-status.enum.js';

export interface MediaResponseInterface {
  id: string;
  kind: MediaKindEnum;
  status: MediaStatusEnum;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}
