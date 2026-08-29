import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigEnvironmentService } from './generic/config/config-environment.module.js';
import { DBService } from './generic/db/db.service.js';
import { sleep } from './generic/util/sleep.util.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks()

  const environment = app.get<ConfigEnvironmentService>(ConfigEnvironmentService)

  const db = app.get(DBService)
  
  await app.listen(environment.get('PORT'));

  while (true) {
    await sleep(1000)
    const result = await db.query(`
      SELECT * FROM (
          VALUES 
              (1, 'Alice', 30),
              (2, 'Bob', 25),
              (3, 'Charlie', 35)
      ) AS t(id, name, age)
      WHERE age > 26;
    `)
    console.log('Result', Math.random() * 2, result.rows)
  }
}
await bootstrap();
