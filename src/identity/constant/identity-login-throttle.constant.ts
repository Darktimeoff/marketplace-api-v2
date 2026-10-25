import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';

export const IDENTITY_LOGIN_THROTTLE_LIMIT = 5;
export const IDENTITY_LOGIN_THROTTLE_TTL_MS = 60_000;

export const identityLoginTracker: ThrottlerGetTrackerFunction = (request) => {
  const login = typeof request.body?.login === 'string' ? request.body.login.trim().toLowerCase() : '';
  return `${request.ip}:${login}`;
};
