import { TopicEnum } from "../../generic/enum/topic.enum.js";
import { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";
import type { MessageContractInterface } from "../../generic/interface/message-contract.interface.js";

export namespace IdentityRegisteredEvent {
  export const TOPIC = TopicEnum.IDENTITY_EVENTS;
  export const TYPE = 'identity.registered';
  export const SOURCE = '/identity-service';

  export interface DataInterface {
    identityId: number;
    identityPublicId: string;
    email: string | null;
    phoneNumber: string | null;
    role: string;
    createdAt: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}

IdentityRegisteredEvent satisfies MessageContractInterface;
