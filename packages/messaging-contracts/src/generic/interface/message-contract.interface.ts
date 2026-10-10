import type { TopicEnum } from '../enum/topic.enum.js';

export interface MessageContractInterface {
  TOPIC: TopicEnum;
  TYPE: string;
  SOURCE: string;
}
