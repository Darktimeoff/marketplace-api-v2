export const RESPONSE_DTO_METADATA = 'response-dto';

export type ClassConstructor = new (...args: unknown[]) => object;

export function ResponseDto(dto: ClassConstructor): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RESPONSE_DTO_METADATA, dto, descriptor.value as object);
  };
}

export function getResponseDto(handler: unknown): ClassConstructor | undefined {
  if (typeof handler !== 'function') {
    return undefined;
  }

  return Reflect.getMetadata(RESPONSE_DTO_METADATA, handler) as ClassConstructor | undefined;
}