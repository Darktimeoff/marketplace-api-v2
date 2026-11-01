import { Injectable } from '@nestjs/common';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListPartsCommand,
  NotFound,
  PutObjectCommand,
  UploadPartCommand,
  type Part,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageClientService } from '../../generic/storage/storage-client.service.js';
import { MEDIA_CACHE_CONTROL, MEDIA_UPLOAD_URL_TTL_SECONDS } from '../constant/media-upload.constant.js';
import type { Media } from '../entity/media.entity.js';
import type { MediaPresignedUploadInterface } from '../interface/media-presigned-upload.interface.js';
import type { MediaStoredObjectInterface } from '../interface/media-stored-object.interface.js';
import type { MediaStoredPartInterface } from '../interface/media-stored-part.interface.js';

@Injectable()
export class MediaStorageService {
  private readonly signedUploadHeaders = new Set(['content-type', 'content-length', 'cache-control']);
  private readonly signedPartHeaders = new Set(['content-length']);

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

  async createMultipartUpload(storageKey: Media['storageKey'], mimeType: Media['mimeType']): Promise<string> {
    const upload = await this.storage.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.storage.bucket,
        Key: storageKey,
        ContentType: mimeType,
        CacheControl: MEDIA_CACHE_CONTROL,
      }),
    );

    if (!upload.UploadId) {
      throw new Error(`Storage returned no UploadId for ${storageKey}`);
    }

    return upload.UploadId;
  }

  presignPart(media: Media, uploadId: string, partNumber: number, contentLength: number): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.storage.bucket,
      Key: media.storageKey,
      UploadId: uploadId,
      PartNumber: partNumber,
      ContentLength: contentLength,
    });

    return getSignedUrl(this.storage.client, command, {
      expiresIn: MEDIA_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: this.signedPartHeaders,
    });
  }

  async listParts(media: Media, uploadId: string): Promise<MediaStoredPartInterface[]> {
    const parts: MediaStoredPartInterface[] = [];
    let marker: string | undefined;

    do {
      const page = await this.storage.client.send(
        new ListPartsCommand({ Bucket: this.storage.bucket, Key: media.storageKey, UploadId: uploadId, PartNumberMarker: marker }),
      );

      for (const part of page.Parts ?? []) {
        parts.push({ partNumber: part.PartNumber ?? 0, etag: part.ETag ?? '', sizeBytes: part.Size ?? 0 });
      }

      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);

    return parts;
  }

  async completeMultipartUpload(media: Media, uploadId: string, parts: MediaStoredPartInterface[]): Promise<void> {
    await this.storage.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.storage.bucket,
        Key: media.storageKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag }) satisfies Part),
        },
      }),
    );
  }

  async head(storageKey: Media['storageKey']): Promise<MediaStoredObjectInterface | null> {
    try {
      const object = await this.storage.client.send(new HeadObjectCommand({ Bucket: this.storage.bucket, Key: storageKey }));
      return { sizeBytes: object.ContentLength ?? 0, mimeType: object.ContentType ?? null, etag: object.ETag ?? null };
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }

      throw error;
    }
  }
}
