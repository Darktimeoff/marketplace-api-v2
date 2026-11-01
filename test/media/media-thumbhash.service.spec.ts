import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { rgbaToThumbHash, thumbHashToApproximateAspectRatio, thumbHashToAverageRGBA } from 'thumbhash';
import { MediaThumbHashService } from '../../src/media/service/media-thumbhash.service.js';

function anImage(width: number, height: number, background: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
}

describe('MediaThumbHashService', () => {
  const service = new MediaThumbHashService();

  it('hashes a downscaled copy into a placeholder with the shape and colour of the image', async () => {
    const hash = await service.fromImage(await anImage(600, 400, { r: 220, g: 30, b: 30 }));

    const bytes = Buffer.from(hash, 'base64');
    expect(bytes.length).toBeLessThanOrEqual(25);
    expect(thumbHashToApproximateAspectRatio(bytes)).toBeCloseTo(1.5, 0);
    const average = thumbHashToAverageRGBA(bytes);
    expect(average.r).toBeGreaterThan(0.7);
    expect(average.g).toBeLessThan(0.2);

    const { data, info } = await sharp(await anImage(600, 400, { r: 220, g: 30, b: 30 })).resize(100, 100, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(hash).toBe(Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64'));
  });

  it('keeps the aspect ratio of images side by side', async () => {
    const images = await Promise.all([1, 2, 3, 4, 5].map((index) => anImage(100 * index, 100, { r: 0, g: 40 * index, b: 200 })));

    const hashes = await Promise.all(images.map((image) => service.fromImage(image)));

    const ratios = hashes.map((hash) => thumbHashToApproximateAspectRatio(Buffer.from(hash, 'base64')));
    expect(ratios[0]).toBe(1);
    expect(ratios).toEqual([...ratios].sort((a, b) => a - b));
    expect(ratios[4]).toBeGreaterThan(4);
  });
});
