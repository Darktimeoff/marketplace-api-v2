import { JobTypeEnum } from "../enum/job-type.enum.js";
import { BaseJobInterface } from "./base-job.interface.js";
import { OrderCreatedDataJobInterface } from "./order-created-data-job.interface.js";

export interface OrderCreatedJobInterface extends BaseJobInterface<JobTypeEnum.ORDER_CREATED, OrderCreatedDataJobInterface> {
  
}