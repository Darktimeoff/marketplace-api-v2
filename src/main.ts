import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvironmentService } from './generic/environment/environment.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks()

  const environment = app.get<EnvironmentService>(EnvironmentService)
  
  await app.listen(environment.get('PORT'));
}
await bootstrap();
