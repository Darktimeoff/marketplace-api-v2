export interface AccountInboxEntityInterface {
  consumer: string;
  messageId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
