export function keepMethodIdentity(original: object, replacement: object): void {
  for (const key of Reflect.getMetadataKeys(original)) {
    Reflect.defineMetadata(key, Reflect.getMetadata(key, original), replacement);
  }

  Object.defineProperty(replacement, 'name', { value: (original as { name: string }).name });
}
