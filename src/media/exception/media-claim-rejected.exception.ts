export class MediaClaimRejectedException extends Error {
  constructor(readonly rejectedMediaIds: string[]) {
    super(`media not claimable: ${rejectedMediaIds.join(', ')}`);
  }
}
