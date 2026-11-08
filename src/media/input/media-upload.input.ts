import { IsIn, IsInt, IsPositive } from 'class-validator';
import type { MediaUploadRequestInterface } from '@marketplace/contracts-core';
import { MEDIA_UPLOAD_TYPES } from '../constant/media-upload.constant.js';

export class MediaUploadInput implements MediaUploadRequestInterface {
  @IsIn(Object.keys(MEDIA_UPLOAD_TYPES))
  mimeType: string;

  @IsInt()
  @IsPositive()
  sizeBytes: number;
}
