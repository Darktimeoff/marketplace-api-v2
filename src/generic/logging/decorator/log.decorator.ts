import { Logger } from '@nestjs/common';
import { createLogDecorator } from '@rnw-community/log-decorator';
import { keepMethodIdentity } from '../../decorator/util/keep-method-identity.util.js';

const loggers = new Map<string, Logger>();

function loggerFor(logContext: string): { logger: Logger; method: string } {
  const [layer, method] = logContext.split('::');
  let logger = loggers.get(layer);

  if (!logger) {
    logger = new Logger(layer);
    loggers.set(layer, logger);
  }

  return { logger, method };
}

type MethodDecoratorType = (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor | void;

function keepingMethodIdentity<TFactory extends (...args: never[]) => MethodDecoratorType>(factory: TFactory): TFactory {
  function decoratorFactory(...args: Parameters<TFactory>): MethodDecoratorType {
    const decorate = factory(...args);

    return function decorator(target, propertyKey, descriptor) {
      const original = descriptor.value;
      const decorated = decorate(target, propertyKey, descriptor) ?? descriptor;
      keepMethodIdentity(original, decorated.value);

      return decorated;
    };
  }

  return decoratorFactory as unknown as TFactory;
}

export const Log = keepingMethodIdentity(createLogDecorator({
  transport: {
    log(message, logContext) {
      const { logger, method } = loggerFor(logContext);
      logger.log(`${method}: ${message}`);
    },
    debug(message, logContext) {
      const { logger, method } = loggerFor(logContext);
      logger.log(`${method}: ${message}`);
    },
    error(message, error, logContext) {
      const { logger, method } = loggerFor(logContext);
      logger.error(`${method}: ${message}`, error instanceof Error ? error.stack : undefined);
    },
  },
}));
