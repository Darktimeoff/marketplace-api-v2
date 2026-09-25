import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seller } from './entity/seller.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Seller])],
})
export class SellerModule {}
