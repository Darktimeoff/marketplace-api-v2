export function decodePem(value: string): string {
  return value.includes('-----BEGIN') ? value : Buffer.from(value, 'base64').toString('utf8');
}
