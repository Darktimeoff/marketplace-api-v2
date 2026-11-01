import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';

@Injectable()
export class MediaThumbHashService {
  private readonly maxSide = 100;

  async fromImage(image: Buffer): Promise<string> {
    const { data, info } = await sharp(image)
      .rotate()
      .resize(this.maxSide, this.maxSide, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64');
  }
}
