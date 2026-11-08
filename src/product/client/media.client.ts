import { Injectable } from '@nestjs/common';
import type { MediaClaimRpc } from '@marketplace/messaging-contracts';
import { MediaClaimCommandHandler } from '../../media/command-handler/media-claim.command-handler.js';
import type { MediaClientInterface } from './media.client.interface.js';

@Injectable()
export class MediaClient implements MediaClientInterface {
  constructor(private readonly mediaClaim: MediaClaimCommandHandler) {}

  claim(request: MediaClaimRpc.RequestInterface): Promise<MediaClaimRpc.ResponseType> {
    return this.mediaClaim.execute(request);
  }
}
