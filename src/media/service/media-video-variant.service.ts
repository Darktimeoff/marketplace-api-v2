import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaKindEnum, MediaVariantNameEnum } from '@marketplace/contracts-core';
import { MEDIA_VIDEO_MAX_HEIGHT, MEDIA_VIDEO_TIMEOUT_MS, MEDIA_WEBP_QUALITY } from '../constant/media-variant.constant.js';
import { MediaUnprocessableException } from '../exception/media-unprocessable.exception.js';
import type { MediaEncodedInterface } from '../interface/media-encoded.interface.js';
import type { MediaEncodedVariantInterface } from '../interface/media-encoded-variant.interface.js';
import type { MediaVariantEncoderInterface } from '../interface/media-variant-encoder.interface.js';

@Injectable()
export class MediaVideoVariantService implements MediaVariantEncoderInterface {
  readonly kind = MediaKindEnum.VIDEO;
  private readonly scale = `scale=-2:'min(${MEDIA_VIDEO_MAX_HEIGHT},ih)'`;
  private readonly stderrTailBytes = 2000;

  async encode(sourcePath: string, outputDir: string): Promise<MediaEncodedInterface> {
    const source = await this.probe(sourcePath).catch((error: unknown) => {
      throw new MediaUnprocessableException(sourcePath, error instanceof Error ? error.message : String(error));
    });
    const videoPath = join(outputDir, `${MediaVariantNameEnum.VIDEO_720}.webm`);
    const posterFramePath = join(outputDir, 'poster.png');
    const posterPath = join(outputDir, `${MediaVariantNameEnum.POSTER}.webp`);

    await this.run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
      '-map', '0:v:0', '-map', '0:a:0?', '-vf', this.scale,
      '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-deadline', 'good', '-cpu-used', '5', '-row-mt', '1',
      '-c:a', 'libopus', '-b:a', '96k',
      videoPath,
    ]);
    await this.run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.min(1, source.durationSeconds / 2)), '-i', sourcePath,
      '-frames:v', '1', '-vf', this.scale,
      posterFramePath,
    ]);

    const encodedVideo = await this.probe(videoPath);
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

  private async probe(path: string): Promise<{ width: number; height: number; durationSeconds: number }> {
    const output = await this.run('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', path,
    ]);
    const probed = JSON.parse(output) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    const stream = probed.streams?.[0];

    if (!stream?.width || !stream.height) {
      throw new Error('no video stream');
    }

    return { width: stream.width, height: stream.height, durationSeconds: Number(probed.format?.duration ?? 0) };
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

        reject(new Error(`${command} exited with ${signal ?? code}: ${stderr.trim()}`));
      });
    });
  }
}
