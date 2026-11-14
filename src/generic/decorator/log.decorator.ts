import { Logger } from '@nestjs/common';
import { createLogDecorator } from '@rnw-community/log-decorator';

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

export const Log = createLogDecorator({
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
});
