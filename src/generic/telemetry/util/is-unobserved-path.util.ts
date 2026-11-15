const unobservedPaths = ['/healthz', '/readyz', '/metrics'];

export function isUnobservedPath(url: string | undefined): boolean {
  return unobservedPaths.includes((url ?? '').split('?')[0]);
}
