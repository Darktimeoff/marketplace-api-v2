import { MediaVariantNameEnum } from '@marketplace/contracts-core';

export const MEDIA_IMAGE_VARIANTS = [
  { name: MediaVariantNameEnum.W320, width: 320 },
  { name: MediaVariantNameEnum.W800, width: 800 },
  { name: MediaVariantNameEnum.W1600, width: 1600 },
];

export const MEDIA_WEBP_QUALITY = 80;

export const MEDIA_VIDEO_MAX_HEIGHT = 720;

export const MEDIA_VIDEO_TIMEOUT_MS = 25 * 60 * 1000;
