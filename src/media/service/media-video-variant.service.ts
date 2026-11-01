import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaKindEnum, MediaVariantNameEnum } from '@marketplace/contracts-core';
import {
  MEDIA_VIDEO_MAX_DURATION_SECONDS,
  MEDIA_VIDEO_MAX_HEIGHT,
  MEDIA_VIDEO_MAX_PIXELS,
  MEDIA_VIDEO_TIMEOUT_MS,
  MEDIA_WEBP_QUALITY,
} from '../constant/media-variant.constant.js';
import { MediaUnprocessableException } from '../exception/media-unprocessable.exception.js';
import type { MediaEncodedInterface } from '../interface/media-encoded.interface.js';
import type { MediaEncodedVariantInterface } from '../interface/media-encoded-variant.interface.js';
import type { MediaVariantEncoderInterface } from '../interface/media-variant-encoder.interface.js';

@Injectable()
export class MediaVideoVariantService implements MediaVariantEncoderInterface {
  readonly kind = MediaKindEnum.VIDEO;
  private readonly scale = `scale=-2:'min(${MEDIA_VIDEO_MAX_HEIGHT},ih)'`;
  private readonly stderrTailBytes = 2000;
  private readonly matroskaMagic = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  private readonly mp4Brand = Buffer.from('ftyp');

  async encode(sourcePath: string, outputDir: string): Promise<MediaEncodedInterface> {
    const demuxer = await this.demuxerOf(sourcePath);
    const source = await this.probe(sourcePath, demuxer).catch((error: unknown) => {
      throw new MediaUnprocessableException(sourcePath, error instanceof Error ? error.message : String(error));
    });

    if (source.width * source.height > MEDIA_VIDEO_MAX_PIXELS || source.durationSeconds > MEDIA_VIDEO_MAX_DURATION_SECONDS) {
      throw new MediaUnprocessableException(sourcePath, `${source.width}x${source.height} for ${source.durationSeconds}s is over the limits`);
    }

    const videoPath = join(outputDir, `${MediaVariantNameEnum.VIDEO_720}.webm`);
    const posterFramePath = join(outputDir, 'poster.png');
    const posterPath = join(outputDir, `${MediaVariantNameEnum.POSTER}.webp`);

    await this.run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', ...this.inputOptions(demuxer), '-i', sourcePath,
      '-t', String(MEDIA_VIDEO_MAX_DURATION_SECONDS), '-map', '0:v:0', '-map', '0:a:0?', '-vf', this.scale,
      '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1',
      '-c:a', 'libopus', '-b:a', '96k',
      videoPath,
    ]);
    await this.run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.min(1, source.durationSeconds / 2)), ...this.inputOptions(demuxer), '-i', sourcePath,
      '-frames:v', '1', '-vf', this.scale,
      posterFramePath,
    ]);

    const encodedVideo = await this.probe(videoPath, 'matroska');
    const poster = await sharp(posterFramePath).webp({ quality: MEDIA_WEBP_QUALITY }).toFile(posterPath);
    const variants: MediaEncodedVariantInterface[] = [
      {
        name: MediaVariantNameEnum.VIDEO_720,
        mimeType: 'video/webm',
        extension: 'webm',
        path: videoPath,
        width: encodedVideo.width,
        height: encodedVideo.height,
        sizeBytes: (await stat(videoPath)).size,
      },
      {
        name: MediaVariantNameEnum.POSTER,
        mimeType: 'image/webp',
        extension: 'webp',
        path: posterPath,
        width: poster.width,
        height: poster.height,
        sizeBytes: poster.size,
      },
    ];

    return { variants, thumbHashSourcePath: posterFramePath };
  }

  private async demuxerOf(sourcePath: string): Promise<string> {
    const file = await open(sourcePath);

    try {
      const { buffer, bytesRead } = await file.read(Buffer.alloc(12), 0, 12, 0);
      const head = buffer.subarray(0, bytesRead);

      if (head.subarray(0, 4).equals(this.matroskaMagic)) {
        return 'matroska';
      }

      if (head.subarray(4, 8).equals(this.mp4Brand)) {
        return 'mov';
      }
    } finally {
      await file.close();
    }

    throw new MediaUnprocessableException(sourcePath, 'not an mp4 or webm container');
  }

  private inputOptions(demuxer: string): string[] {
    return ['-protocol_whitelist', 'file', '-f', demuxer];
  }

  private async probe(path: string, demuxer: string): Promise<{ width: number; height: number; durationSeconds: number }> {
    const output = await this.run('ffprobe', [
      '-v', 'error', ...this.inputOptions(demuxer), '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path,
    ]);
    const probed = JSON.parse(output) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    const stream = probed.streams?.[0];

    if (!stream?.width || !stream.height) {
      throw new Error('no video stream');
    }

    const durationSeconds = Number(probed.format?.duration);

    return { width: stream.width, height: stream.height, durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0 };
  }

  private run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: MEDIA_VIDEO_TIMEOUT_MS, killSignal: 'SIGKILL' });
      const stdout: Buffer[] = [];
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-this.stderrTailBytes);
      });
      child.on('error', reject);
      child.on('close', (code, signal) => {
        if (code === 0) {
          resolve(Buffer.concat(stdout).toString());
          return;
        }

        if (signal === 'SIGKILL') {
          reject(new MediaUnprocessableException(command, `killed after ${MEDIA_VIDEO_TIMEOUT_MS} ms`));
          return;
        }

        reject(new Error(`${command} exited with ${signal ?? code}: ${stderr.trim()}`));
      });
    });
  }
}
