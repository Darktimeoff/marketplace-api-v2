import { Injectable } from '@nestjs/common';
import { HeadObjectCommand, NotFound, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageClientService } from '../../generic/storage/storage-client.service.js';
import { MEDIA_CACHE_CONTROL, MEDIA_UPLOAD_URL_TTL_SECONDS } from '../constant/media-upload.constant.js';
import type { Media } from '../entity/media.entity.js';
import type { MediaPresignedUploadInterface } from '../interface/media-presigned-upload.interface.js';
import type { MediaStoredObjectInterface } from '../interface/media-stored-object.interface.js';

@Injectable()
export class MediaStorageService {
  private readonly signedUploadHeaders = new Set(['content-type', 'content-length', 'cache-control']);

  constructor(private readonly storage: StorageClientService) {}

  async presignUpload(media: Media): Promise<MediaPresignedUploadInterface> {
    const expiresAt = new Date(Date.now() + MEDIA_UPLOAD_URL_TTL_SECONDS * 1000);
    const command = new PutObjectCommand({
      Bucket: this.storage.bucket,
      Key: media.storageKey,
      ContentType: media.mimeType,
      ContentLength: media.sizeBytes,
      CacheControl: MEDIA_CACHE_CONTROL,
    });
    const url = await getSignedUrl(this.storage.client, command, {
      expiresIn: MEDIA_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: this.signedUploadHeaders,
    });

    return {
      url,
      headers: {
        'content-type': media.mimeType,
        'cache-control': MEDIA_CACHE_CONTROL,
      },
      expiresAt,
    };
  }

  async head(storageKey: Media['storageKey']): Promise<MediaStoredObjectInterface | null> {
    try {
      const object = await this.storage.client.send(new HeadObjectCommand({ Bucket: this.storage.bucket, Key: storageKey }));
      return { sizeBytes: object.ContentLength ?? 0, mimeType: object.ContentType ?? null };
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }

      throw error;
    }
  }
}
