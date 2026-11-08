import type { MediaClaimRpc } from '@marketplace/messaging-contracts';

export interface MediaClientInterface {
  claim(request: MediaClaimRpc.RequestInterface): Promise<MediaClaimRpc.ResponseType>;
}
