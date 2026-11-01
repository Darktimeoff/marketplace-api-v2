export interface RabbitMqRpcCallInterface<TData> {
  exchange: string;
  method: string;
  source: string;
  id: string;
  data: TData;
}
