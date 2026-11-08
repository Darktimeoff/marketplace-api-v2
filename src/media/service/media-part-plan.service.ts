import { Injectable } from '@nestjs/common';
import {
  MEDIA_MULTIPART_THRESHOLD_BYTES,
  STORAGE_MAX_PART_COUNT,
  STORAGE_MIN_PART_SIZE_BYTES,
} from '../constant/media-upload.constant.js';

@Injectable()
export class MediaPartPlanService {
  private readonly mebibyte = 1024 * 1024;

  isMultipart(sizeBytes: number): boolean {
    return sizeBytes >= MEDIA_MULTIPART_THRESHOLD_BYTES;
  }

  partSize(sizeBytes: number): number {
    const smallestAllowed = Math.ceil(sizeBytes / STORAGE_MAX_PART_COUNT / this.mebibyte) * this.mebibyte;
    return Math.max(STORAGE_MIN_PART_SIZE_BYTES, smallestAllowed);
  }

  partCount(sizeBytes: number): number {
    return Math.ceil(sizeBytes / this.partSize(sizeBytes));
  }

  partLength(sizeBytes: number, partNumber: number): number {
    const partSize = this.partSize(sizeBytes);
    return Math.min(partSize, sizeBytes - (partNumber - 1) * partSize);
  }
}
