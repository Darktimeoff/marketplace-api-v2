export interface GoogleIdentityInterface {
  subject: string;
  email: string | null;
  emailVerified: boolean;
}
