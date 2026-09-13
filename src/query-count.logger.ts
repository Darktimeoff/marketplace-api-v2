import { Logger, QueryRunner } from 'typeorm';

/**
 * N+1 не виден в коде — он виден только в логе SQL. Этот логгер считает каждый
 * запрос, который TypeORM реально отправил в базу, и при желании печатает его.
 */
export class QueryCountLogger implements Logger {
  count = 0;
  print = false;

  reset(print = false): void {
    this.count = 0;
    this.print = print;
  }

  logQuery(query: string): void {
    this.count += 1;

    if (this.print) {
      const flat = query.replace(/\s+/g, ' ').trim();
      console.log(`    [${String(this.count).padStart(2, ' ')}] ${flat.slice(0, 110)}`);
    }
  }

  logQueryError(error: string | Error, query: string): void {
    console.error('query failed:', error, query);
  }

  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}

  log(level: 'log' | 'info' | 'warn', message: unknown, _queryRunner?: QueryRunner): void {
    if (level === 'warn') {
      console.warn(message);
    }
  }
}
