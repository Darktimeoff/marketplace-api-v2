import { Controller, Get } from '@nestjs/common';
import { Public } from '../generic/auth/decorator/public.decorator.js';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
