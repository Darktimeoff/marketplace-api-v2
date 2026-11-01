import { MediaKindEnum } from '@marketplace/contracts-core';
import type { MediaUploadTypeInterface } from '../interface/media-upload-type.interface.js';

const MIB = 1024 * 1024;

export const MEDIA_UPLOAD_TYPES: Record<string, MediaUploadTypeInterface> = {
  'image/jpeg': { kind: MediaKindEnum.IMAGE, extension: 'jpg', maxSizeBytes: 20 * MIB },
  'image/png': { kind: MediaKindEnum.IMAGE, extension: 'png', maxSizeBytes: 20 * MIB },
  'image/webp': { kind: MediaKindEnum.IMAGE, extension: 'webp', maxSizeBytes: 20 * MIB },
  'video/mp4': { kind: MediaKindEnum.VIDEO, extension: 'mp4', maxSizeBytes: 5 * 1024 * MIB },
  'video/webm': { kind: MediaKindEnum.VIDEO, extension: 'webm', maxSizeBytes: 5 * 1024 * MIB },
};

export const MEDIA_UPLOAD_URL_TTL_SECONDS = 300;

export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';
