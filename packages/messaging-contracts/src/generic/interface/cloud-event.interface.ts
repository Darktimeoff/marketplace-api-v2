export interface CloudEventInterface<TType extends string, TData> {
  specversion: '1.0';
  id: string;
  source: string;
  type: TType;
  time: string;
  datacontenttype: 'application/json';
  subject?: string;
  correlationid?: string;
  data: TData;
}
