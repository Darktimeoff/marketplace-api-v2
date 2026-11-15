import type { SecurityHeadersOptions } from '@nestjs/common';

export const SECURITY_HEADERS: SecurityHeadersOptions = {
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  strictTransportSecurity: false,
};
