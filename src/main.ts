import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { EnvironmentService } from './generic/environment/environment.module.js';
import { missingEnvironmentSecrets } from './generic/secret-manager/missing-environment-secrets.js';
import { SECURITY_HEADERS } from './generic/http/constant/security-headers.constant.js';

async function bootstrap() {
  const missing = missingEnvironmentSecrets(process.env);

  if (missing.length > 0) {
    console.error(`Missing secrets: ${missing.join(', ')}. With SKIP_VAULT=1 they must be exported; otherwise run npm run start:vault.`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useSecurityHeaders(SECURITY_HEADERS);

  app.enableShutdownHooks([], { useProcessExit: true })

  const environment = app.get<EnvironmentService>(EnvironmentService)
  
  await app.listen(environment.get('PORT'));
}
await bootstrap();
