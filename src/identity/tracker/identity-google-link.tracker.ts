import type { AuthenticatedRequestInterface } from '../../generic/auth/interface/authenticated-request.interface.js';

export function identityGoogleLinkTracker(request: Pick<AuthenticatedRequestInterface, 'identity'> & { ip?: string }): string {
  return `google-link:${request.ip ?? ''}:${request.identity?.identityPublicId ?? ''}`;
}
