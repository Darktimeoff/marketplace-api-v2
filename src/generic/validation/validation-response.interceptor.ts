import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { map, type Observable } from 'rxjs';
import { getResponseDto, type ClassConstructor } from './response-dto.decorator.js';

@Injectable()
export class ValidationResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const dto = getResponseDto(context.getHandler());

    if (!dto) {
      return next.handle();
    }

    return next.handle().pipe(map((data: unknown) => this.toValidatedDto(dto, data)));
  }

  private toValidatedDto(dto: ClassConstructor, data: unknown): unknown {
    if (data === null || data === undefined || typeof data !== 'object') {
      throw new InternalServerErrorException(
        `Response marked with @ResponseDto(${dto.name}) must be an object, got ${typeof data}`,
      );
    }

    const instance = plainToInstance(dto, data, { excludeExtraneousValues: true });
    const errors = validateSync(instance, { whitelist: true });

    if (errors.length > 0) {
      throw new InternalServerErrorException({
        message: `Response does not match ${dto.name}`,
        errors: this.flatten(errors),
      });
    }

    return instance;
  }

  private flatten(errors: ValidationError[], parent = ''): string[] {
    return errors.flatMap((error) => {
      const path = parent ? `${parent}.${error.property}` : error.property;
      const own = Object.values(error.constraints ?? {}).map((message) => `${path}: ${message}`);
      const nested = this.flatten(error.children ?? [], path);

      return [...own, ...nested];
    });
  }
}