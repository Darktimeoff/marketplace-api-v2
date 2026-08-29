import { Module } from '@nestjs/common';
import { ConfigEnvironmentModule } from './generic/config/config-environment.module.js';

@Module({
  imports: [ConfigEnvironmentModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
