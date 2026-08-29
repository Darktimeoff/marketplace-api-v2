import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigEnvironmentService } from './generic/config/config-environment.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks()

  const environment = app.get<ConfigEnvironmentService>(ConfigEnvironmentService)
  
  await app.listen(environment.get('PORT'));
}
await bootstrap();
