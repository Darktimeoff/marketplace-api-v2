import { IsEnum, IsInt, IsObject, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import { BackgroundJobTypeEnum } from '../../entities/enums.js';

export class BackgroundJobCreateInput {
  @IsEnum(BackgroundJobTypeEnum)
  type: BackgroundJobTypeEnum;

  @IsObject()
  payload: Record<string, unknown>;

  /** Натуральный ключ задачи: повторная постановка с тем же ключом
   *  упирается в unique-констрейнт, а не создаёт вторую строку. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  dedupeKey: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number | null;
}