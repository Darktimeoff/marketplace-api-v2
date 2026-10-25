export function identityLoginTracker(request: { ip?: string; body?: { login?: unknown } }): string {
  const login = typeof request.body?.login === 'string' ? request.body.login.trim().toLowerCase() : '';
  return `${request.ip}:${login}`;
}
