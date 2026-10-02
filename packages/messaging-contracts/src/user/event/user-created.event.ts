import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";
import type { LanguageEnum } from "@marketplace/contracts-core";

export namespace UserCreatedEvent {
  export const TOPIC = TopicEnum.USER_EVENTS;
  export const TYPE = 'user.created';
  export const SOURCE = '/user-service';

  export interface DataInterface {
    userId: number;
    userPublicId: string;
    identityId: number;
    email: string | null;
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    language: LanguageEnum;
    createdAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

UserCreatedEvent satisfies MessageContractInterface;
