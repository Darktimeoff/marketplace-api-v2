import type { MediaVariantNameEnum } from '@marketplace/contracts-core';
import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { SourceEnum } from "../../generic/enum/source.enum.js";
import type { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";

export namespace MediaVariantsGeneratedEvent {
  export const TOPIC = TopicEnum.MEDIA_EVENTS;
  export const TYPE = 'media.variants.generated';
  export const SOURCE = SourceEnum.MEDIA;

  export interface VariantInterface {
    name: MediaVariantNameEnum;
    mimeType: string;
    storageKey: string;
    width: number;
    height: number;
  }

  export interface DataInterface {
    mediaPublicId: string;
    thumbHash: string;
    variants: VariantInterface[];
    generatedAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

MediaVariantsGeneratedEvent satisfies MessageContractInterface;
