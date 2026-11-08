export interface MediaPresignedUploadInterface {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}
