import { SourceEnum } from "../../generic/enum/source.enum.js";
import type { CloudEventInterface } from "../../generic/interface/cloud-event.interface.js";

export namespace MediaVariantsGenerateJob {
  export const TYPE = 'media.variants.generate';
  export const SOURCE = SourceEnum.MEDIA;

  export interface DataInterface {
    mediaPublicId: string;
  }

  export type MessageType = CloudEventInterface<typeof TYPE, DataInterface>;
}
