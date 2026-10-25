export interface GoogleSignInAttemptInterface {
  state: string;
  nonce: string;
  codeVerifier: string;
  linkIdentityPublicId: string | null;
}
