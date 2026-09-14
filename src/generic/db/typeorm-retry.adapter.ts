import { Logger } from '@nestjs/common';
import { TransactionalAdapter } from '@nestjs-cls/transactional';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel.js';

const logger = new Logger('TransactionalAdapterTypeOrmWithRetry');

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

const DEADLOCK_ERROR_CODES = new Set([
  '40P01',
  '40001',
  'ER_LOCK_DEADLOCK',
]);

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
      fn: (...args: unknown[]) => Promise<unknown>,
      setTx: (client?: EntityManager) => void,
    ) => {
      const runInTransaction = (trx: EntityManager) => {
        setTx(trx);
        return fn();
      };

      return retryTransactionOnDeadlock(
        () =>
          options?.isolationLevel
            ? dataSource.transaction(options.isolationLevel, runInTransaction)
            : dataSource.transaction(runInTransaction),
        this.retryOptions,
      );
    },
    wrapWithNestedTransaction: (
      options: TypeOrmTransactionOptions,
      fn: (...args: unknown[]) => Promise<unknown>,
      setTx: (client?: EntityManager) => void,
      client: EntityManager,
    ) => {
      const runInTransaction = (trx: EntityManager) => {
        setTx(trx);
        return fn();
      };

      return options?.isolationLevel
        ? client.transaction(options.isolationLevel, runInTransaction)
        : client.transaction(runInTransaction);
    },
    getFallbackInstance: () => dataSource.manager,
  });
}

async function retryTransactionOnDeadlock<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 50 }: RetryTransactionOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isDeadlockError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delay = backoff + jitter;
      logger.warn(`Deadlock detected, retrying (attempt ${attempt}/${maxAttempts}) after ${delay.toFixed(0)}ms`);
      await sleep(delay);
    }
  }
}

function isDeadlockError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const code = (error.driverError as { code?: string } | undefined)?.code;
  return typeof code === 'string' && DEADLOCK_ERROR_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}