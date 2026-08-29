import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigEnvironmentType, validate } from './config-environment.schema.js';

@Injectable()
export class ConfigEnvironmentService extends ConfigService<ConfigEnvironmentType, true> {
  
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
      validate
    })
  ],
  providers: [ConfigEnvironmentService],
  exports: [ConfigEnvironmentService]
})
export class ConfigEnvironmentModule {}