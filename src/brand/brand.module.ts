import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from './entity/brand.entity.js';
import { BrandTranslation } from './entity/brand-translation.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, BrandTranslation])],
})
export class BrandModule {}
