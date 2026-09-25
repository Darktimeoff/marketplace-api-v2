import { ValueTransformer } from 'typeorm';

/**
 * Деньги в схеме ДЗ #12 — numeric(12,2) через домен "amount", и схему это ДЗ не меняет.
 * pg отдаёт numeric строкой, и строкой же он тут и остаётся: перевод в number сделал бы
 * из точного десятичного значения double, то есть ровно ту ошибку, от которой numeric и
 * защищает. На запись number принимается для удобства и сразу нормализуется в строку.
 */
export const moneyTransformer: ValueTransformer = {
  to: (value?: string | number | null) => {
    if (value === null || value === undefined) {
      return value;
    }

    return typeof value === 'number' ? value.toFixed(2) : value;
  },
  from: (value?: string | null) => value,
};
