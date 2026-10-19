import type { TopicEnum } from '../enum/topic.enum.js';
import type { SourceEnum } from '../enum/source.enum.js';

export interface MessageContractInterface {
  TOPIC: TopicEnum;
  TYPE: string;
  SOURCE: SourceEnum;
}
