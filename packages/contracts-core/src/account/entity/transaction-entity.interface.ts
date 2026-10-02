import type { TransactionStatusEnum } from '../enum/transaction-status.enum.js';
import type { TransactionTypeEnum } from '../enum/transaction-type.enum.js';

export interface TransactionEntityInterface {
  id: number;
  customerId: number;
  amount: string;
  status: TransactionStatusEnum;
  type: TransactionTypeEnum;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
