import { Injectable } from '@nestjs/common';
import type { MediaResponseInterface, MediaUploadResponseInterface } from '@marketplace/contracts-core';
import type { Media } from '../entity/media.entity.js';
import type { MediaPresignedUploadInterface } from '../interface/media-presigned-upload.interface.js';

@Injectable()
export class MediaResponseService {
  toMedia(media: Media): MediaResponseInterface {
    return {
      id: media.publicId,
      kind: media.kind,
      status: media.status,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      createdAt: media.createdAt,
    };
  }

  toUpload(media: Media, upload: MediaPresignedUploadInterface): MediaUploadResponseInterface {
    return {
      ...this.toMedia(media),
      url: upload.url,
      headers: upload.headers,
      expiresAt: upload.expiresAt,
    };
  }
}
