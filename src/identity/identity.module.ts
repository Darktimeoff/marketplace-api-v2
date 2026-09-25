import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Identity } from './entity/identity.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Identity])],
})
export class IdentityModule {}
