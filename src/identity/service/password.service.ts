import { Injectable, OnModuleInit } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash: string;

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id });
  }

  async verify(passwordHash: string | null, password: string): Promise<boolean> {
    const matches = await verify(passwordHash?.startsWith('$argon2') ? passwordHash : this.dummyHash, password);
    return passwordHash !== null && matches;
  }
}
