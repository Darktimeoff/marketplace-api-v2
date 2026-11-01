import { ValueTransformer } from 'typeorm';

export const bigintNumberTransformer: ValueTransformer = {
  to(value?: number | null) {
    return value;
  },
  from(value?: string | null) {
    return value === null || value === undefined ? value : Number(value);
  },
};
