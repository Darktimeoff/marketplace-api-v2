export class MediaUnprocessableException extends Error {
  constructor(readonly storageKey: string, reason: string) {
    super(`media ${storageKey} cannot be processed: ${reason}`);
  }
}
