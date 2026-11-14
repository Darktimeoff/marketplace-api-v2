import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, SetMetadata } from '@nestjs/common';
import { Log } from '../../../src/generic/logging/decorator/log.decorator.js';

class OrderCleanupCron {
  @Log('starting', (deleted: number) => `deleted ${deleted} rows`, (error) => `failed: ${String(error)}`)
  async handle(fail: boolean): Promise<number> {
    if (fail) {
      throw new Error('database down');
    }

    return 3;
  }
}

describe('Log decorator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs before and after the call under the class as the layer, naming the method', async () => {
    const lines: { layer: string; message: unknown }[] = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation(function (this: Logger, message: unknown) {
      lines.push({ layer: (this as unknown as { context: string }).context, message });
    });

    expect(await new OrderCleanupCron().handle(false)).toBe(3);
    expect(lines).toEqual([
      { layer: 'OrderCleanupCron', message: 'handle: starting' },
      { layer: 'OrderCleanupCron', message: 'handle: deleted 3 rows' },
    ]);
  });

  it('logs the failure with its stack and rethrows it', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(new OrderCleanupCron().handle(true)).rejects.toThrow('database down');
    expect(error.mock.calls[0][0]).toBe('handle: failed: Error: database down');
    expect(error.mock.calls[0][1]).toContain('Error: database down');
  });

  it('keeps the method name and the metadata Nest decorators put on it, so routes and span names survive', () => {
    class OrderController {
      @Log('placing order')
      @SetMetadata('role', 'buyer')
      async create(): Promise<void> {}
    }

    expect(OrderController.prototype.create.name).toBe('create');
    expect(Reflect.getMetadata('role', OrderController.prototype.create)).toBe('buyer');
  });
});
