import { JobTypeEnum } from "../enum/job-type.enum.js";

export interface BaseJobInterface<TType extends JobTypeEnum = any, TData extends object = object> {
  id: string;
  type: TType;
  data: TData;
  correlationId: string
  createdAt: Date
}