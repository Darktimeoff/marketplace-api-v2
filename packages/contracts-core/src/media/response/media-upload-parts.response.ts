export interface MediaUploadPartResponseInterface {
  partNumber: number;
  url: string;
}

export interface MediaUploadPartsResponseInterface {
  id: string;
  partSize: number;
  partCount: number;
  uploadedPartCount: number;
  parts: MediaUploadPartResponseInterface[];
  expiresAt: Date;
}
