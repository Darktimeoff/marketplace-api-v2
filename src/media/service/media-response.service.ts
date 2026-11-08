import { Injectable } from '@nestjs/common';
import type {
  MediaResponseInterface,
  MediaUploadPartResponseInterface,
  MediaUploadPartsResponseInterface,
  MediaUploadResponseInterface,
} from '@marketplace/contracts-core';
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
      partSize: null,
      partCount: null,
    };
  }

  toMultipartUpload(media: Media, partSize: number, partCount: number): MediaUploadResponseInterface {
    return {
      ...this.toMedia(media),
      url: null,
      headers: null,
      expiresAt: null,
      partSize,
      partCount,
    };
  }

  toParts(
    media: Media,
    partSize: number,
    partCount: number,
    uploadedPartCount: number,
    parts: MediaUploadPartResponseInterface[],
    expiresAt: Date,
  ): MediaUploadPartsResponseInterface {
    return {
      id: media.publicId,
      partSize,
      partCount,
      uploadedPartCount,
      parts,
      expiresAt,
    };
  }
}
