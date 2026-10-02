import type { RoleEnum } from '../enum/role.enum.js';

export interface IdentityEntityInterface {
  id: number;
  email: string | null;
  phoneId: number | null;
  passwordHash: string;
  role: RoleEnum;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
