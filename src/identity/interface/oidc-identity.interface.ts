export interface OidcIdentityInterface {
  subject: string;
  email: string | null;
  emailVerified: boolean;
}
