import type { MediaAttachmentTypeEnum, MediaClaimStatusEnum, MediaKindEnum } from '@marketplace/contracts-core';

export namespace MediaClaimRpc {
  export const METHOD = 'media.claim';

  export interface AttachToInterface {
    type: MediaAttachmentTypeEnum;
    id: string;
  }

  export interface RequestInterface {
    ownerPublicId: string;
    mediaIds: string[];
    attachTo: AttachToInterface;
  }

  export interface ClaimedMediaInterface {
    id: string;
    kind: MediaKindEnum;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }

  export interface ClaimedResponseInterface {
    status: MediaClaimStatusEnum.CLAIMED;
    media: ClaimedMediaInterface[];
  }

  export interface RejectedResponseInterface {
    status: MediaClaimStatusEnum.REJECTED;
    rejectedMediaIds: string[];
  }

  export type ResponseType = ClaimedResponseInterface | RejectedResponseInterface;
}
