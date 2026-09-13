import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackgroundJob } from './entity/background-job.entity.js';
import { BackgroundJobRepository } from './repository/background-job.repository.js';
import { BackgroundJobService } from './service/background-job.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([BackgroundJob])],
  providers: [BackgroundJobRepository, BackgroundJobService],
  exports: [BackgroundJobService],
})
export class BackgroundJobModule {}