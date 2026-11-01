import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { MediaImageVariantService } from '../../src/media/service/media-image-variant.service.js';
import { MediaVideoVariantService } from '../../src/media/service/media-video-variant.service.js';
import { MediaUnprocessableException } from '../../src/media/exception/media-unprocessable.exception.js';

describe('media variant encoders', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'media-encoders-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function anImage(width: number, height: number, orientation?: number): Promise<string> {
    const path = join(dir, 'source');
    const image = sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg();
    await (orientation ? image.withMetadata({ orientation }) : image).toFile(path);
    return path;
  }

  it('resizes an image to every width it can fill, as webp', async () => {
    const encoded = await new MediaImageVariantService().encode(await anImage(2000, 1000), dir);

    expect(encoded.variants.map(({ name, mimeType, width, height }) => ({ name, mimeType, width, height }))).toEqual([
      { name: MediaVariantNameEnum.W320, mimeType: 'image/webp', width: 320, height: 160 },
      { name: MediaVariantNameEnum.W800, mimeType: 'image/webp', width: 800, height: 400 },
      { name: MediaVariantNameEnum.W1600, mimeType: 'image/webp', width: 1600, height: 800 },
    ]);
    for (const variant of encoded.variants) {
      expect(await sharp(variant.path).metadata()).toMatchObject({ format: 'webp', width: variant.width, height: variant.height });
      expect((await stat(variant.path)).size).toBe(variant.sizeBytes);
    }
  });

  it('never enlarges: a small image gets only the smallest variant at its own size', async () => {
    const encoded = await new MediaImageVariantService().encode(await anImage(200, 100), dir);

    expect(encoded.variants.map(({ name, width, height }) => ({ name, width, height }))).toEqual([{ name: MediaVariantNameEnum.W320, width: 200, height: 100 }]);
  });

  it('applies the EXIF orientation, so a portrait photo stays portrait', async () => {
    const encoded = await new MediaImageVariantService().encode(await anImage(1000, 500, 6), dir);

    expect(encoded.variants.map(({ width, height }) => ({ width, height }))).toEqual([{ width: 320, height: 640 }]);
  });

  it('refuses bytes that are not an image as unprocessable', async () => {
    const path = join(dir, 'source');
    await writeFile(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(500)]));

    await expect(new MediaImageVariantService().encode(path, dir)).rejects.toBeInstanceOf(MediaUnprocessableException);
  });

  it('encodes a video to vp9 webm without enlarging it, with a webp poster', async () => {
    const path = join(dir, 'source');
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-f', 'mp4', path,
    ]);

    const encoded = await new MediaVideoVariantService().encode(path, dir);

    expect(encoded.variants.map(({ name, mimeType, width, height }) => ({ name, mimeType, width, height }))).toEqual([
      { name: MediaVariantNameEnum.VIDEO_720, mimeType: 'video/webm', width: 640, height: 360 },
      { name: MediaVariantNameEnum.POSTER, mimeType: 'image/webp', width: 640, height: 360 },
    ]);
    const streams = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', encoded.variants[0].path]).toString().trim().split('\n');
    expect(streams).toEqual(['vp9', 'opus']);
    expect(encoded.thumbHashSourcePath).not.toBe(path);
  }, 60_000);

  it('refuses a file without a video stream as unprocessable', async () => {
    const path = join(dir, 'source');
    await writeFile(path, randomBytes(2000));

    await expect(new MediaVideoVariantService().encode(path, dir)).rejects.toBeInstanceOf(MediaUnprocessableException);
  });
});
