import { Injectable, Logger as NestLogger, OnModuleInit } from '@nestjs/common';
import { Runtime, type Logger, type LogLevel, type LogMetadata } from '@temporalio/worker';

@Injectable()
export class TemporalRuntimeService implements OnModuleInit, Logger {
  private readonly logger = new NestLogger('Temporal');

  onModuleInit(): void {
    if (!Runtime._instance) {
      Runtime.install({ logger: this });
    }
  }

  log(level: LogLevel, message: string, meta: LogMetadata = {}): void {
    const { error, ...fields } = meta;
    const entry = { msg: message, ...fields, ...(error ? { err: error } : {}) };

    if (level === 'ERROR') {
      this.logger.error(entry);
    } else if (level === 'WARN') {
      this.logger.warn(entry);
    } else if (level === 'INFO') {
      this.logger.log(entry);
    } else {
      this.logger.debug(entry);
    }
  }

  trace(message: string, meta?: LogMetadata): void {
    this.log('TRACE', message, meta);
  }

  debug(message: string, meta?: LogMetadata): void {
    this.log('DEBUG', message, meta);
  }

  info(message: string, meta?: LogMetadata): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: LogMetadata): void {
    this.log('ERROR', message, meta);
  }
}
