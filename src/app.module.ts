import { Module } from '@nestjs/common';
import { ConfigEnvironmentModule } from './generic/config/config-environment.module.js';
import { DBModule } from './generic/db/db.module.js';

@Module({
  imports: [ConfigEnvironmentModule, DBModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
