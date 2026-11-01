import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
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

  function ffmpeg(args: string[]): void {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  }

  it('encodes a webm source too, read with the matroska demuxer', async () => {
    const path = join(dir, 'source');
    ffmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=1:size=160x120:rate=12', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-f', 'webm', path]);

    const encoded = await new MediaVideoVariantService().encode(path, dir);

    expect(encoded.variants.map(({ width, height }) => ({ width, height }))).toEqual([
      { width: 160, height: 120 },
      { width: 160, height: 120 },
    ]);
  }, 60_000);

  it('never lets ffmpeg guess the container: a playlist uploaded as a video is refused before ffmpeg reads it', async () => {
    const path = join(dir, 'source');
    await writeFile(path, '#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\nfile:///etc/passwd\n#EXTINF:10.0,\nhttp://127.0.0.1:1/secret\n#EXT-X-ENDLIST\n');

    await expect(new MediaVideoVariantService().encode(path, dir)).rejects.toThrow('not an mp4 or webm container');
  });

  it('refuses a video longer than the limit before encoding it', async () => {
    const path = join(dir, 'source');
    ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=1:d=660', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-f', 'mp4', path]);

    await expect(new MediaVideoVariantService().encode(path, dir)).rejects.toThrow('is over the limits');
  }, 60_000);

  it('refuses an image format that was not allowed, even when sharp could decode it', async () => {
    const path = join(dir, 'source');
    await writeFile(path, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="red"/></svg>');

    await expect(new MediaImageVariantService().encode(path, dir)).rejects.toThrow('format svg is not allowed');
  });

  function aPngChunk(type: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([length, body, crc]);
  }

  it('refuses an image whose header declares too many pixels, without decoding it', async () => {
    const path = join(dir, 'source');
    const header = Buffer.alloc(13);
    header.writeUInt32BE(8000, 0);
    header.writeUInt32BE(8000, 4);
    header.set([8, 2, 0, 0, 0], 8);
    await writeFile(path, Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      aPngChunk('IHDR', header),
      aPngChunk('IDAT', deflateSync(Buffer.alloc(0))),
      aPngChunk('IEND', Buffer.alloc(0)),
    ]));

    await expect(new MediaImageVariantService().encode(path, dir)).rejects.toThrow('8000x8000 is over 50000000 pixels');
  });
});
