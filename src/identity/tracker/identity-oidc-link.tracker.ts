import type { AuthenticatedRequestInterface } from '../../generic/auth/interface/authenticated-request.interface.js';

export function identityOidcLinkTracker(request: Pick<AuthenticatedRequestInterface, 'identity'> & { ip?: string }): string {
  return `oidc-link:${request.ip ?? ''}:${request.identity?.identityPublicId ?? ''}`;
}
