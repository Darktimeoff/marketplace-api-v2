import { Logger } from '@nestjs/common';
import { TransactionalAdapter } from '@nestjs-cls/transactional';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel.js';

const logger = new Logger('TransactionalAdapterTypeOrmWithRetry');

const DEADLOCK_ERROR_CODES = new Set(['40P01', '40001']);

type TransactionCallback = (...args: unknown[]) => Promise<unknown>;
type SetTransaction = (client?: EntityManager) => void;

export interface TypeOrmTransactionOptions {
  isolationLevel?: IsolationLevel;
}

interface RetryTransactionOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export interface TypeOrmRetryAdapterOptions extends RetryTransactionOptions {
  dataSourceToken: unknown;
}

export interface TransactionRetryInfo {
  attempt: number;
  maxAttempts: number;
  code: string;
  delayMs: number;
  message: string;
}

export type TransactionRetryListener = (info: TransactionRetryInfo) => void;

const retryListeners = new Set<TransactionRetryListener>();

export function onTransactionRetry(listener: TransactionRetryListener): () => void {
  retryListeners.add(listener);

  return () => {
    retryListeners.delete(listener);
  };
}

export class TransactionalAdapterTypeOrmWithRetry
  implements TransactionalAdapter<DataSource, EntityManager, TypeOrmTransactionOptions>
{
  connectionToken: unknown;
  private readonly retryOptions: RetryTransactionOptions;

  constructor({ dataSourceToken, ...retryOptions }: TypeOrmRetryAdapterOptions) {
    this.connectionToken = dataSourceToken;
    this.retryOptions = retryOptions;
  }

  optionsFactory = (dataSource: DataSource) => ({
    wrapWithTransaction: (
      options: TypeOrmTransactionOptions,
      fn: TransactionCallback,
      setTx: SetTransaction,
    ) => {
      const run = bindTransaction(fn, setTx);

      return retryTransactionOnDeadlock(
        () =>
          options?.isolationLevel
            ? dataSource.transaction(options.isolationLevel, run)
            : dataSource.transaction(run),
        this.retryOptions,
      );
    },

    wrapWithNestedTransaction: (
      options: TypeOrmTransactionOptions,
      fn: TransactionCallback,
      setTx: SetTransaction,
      client: EntityManager,
    ) => {
      const run = bindTransaction(fn, setTx);

      return options?.isolationLevel
        ? client.transaction(options.isolationLevel, run)
        : client.transaction(run);
    },

    getFallbackInstance: () => dataSource.manager,
  });
}

function bindTransaction(fn: TransactionCallback, setTx: SetTransaction) {
  return (trx: EntityManager) => {
    setTx(trx);
    return fn();
  };
}

async function retryTransactionOnDeadlock<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 50 }: RetryTransactionOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const code = deadlockErrorCode(error);

      if (code === null || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = Math.round(baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs);

      logger.warn(`Deadlock detected, retrying (attempt ${attempt}/${maxAttempts}) after ${delayMs}ms`);
      notifyRetry({
        attempt,
        maxAttempts,
        code,
        delayMs,
        message: error instanceof Error ? error.message : String(error),
      });

      await sleep(delayMs);
    }
  }
}

function notifyRetry(info: TransactionRetryInfo): void {
  for (const listener of retryListeners) {
    listener(info);
  }
}

function deadlockErrorCode(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) {
    return null;
  }

  const code = (error.driverError as { code?: string } | undefined)?.code;

  return typeof code === 'string' && DEADLOCK_ERROR_CODES.has(code) ? code : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
