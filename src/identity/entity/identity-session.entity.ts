import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Identity } from './identity.entity.js';

@Entity('IdentitySession')
@Index('IdentitySession_identityId_idx', ['identityId'])
@Index('IdentitySession_familyId_idx', ['familyId'])
@Check('IdentitySession_expiresAt_order', `"expiresAt" > "createdAt"`)
@Check('IdentitySession_usedAt_order', `"usedAt" IS NULL OR "usedAt" >= "createdAt"`)
@Check('IdentitySession_revokedAt_order', `"revokedAt" IS NULL OR "revokedAt" >= "createdAt"`)
export class IdentitySession {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  identityId: number;

  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @ManyToOne(() => Identity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'identityId' })
  identity: Identity;
}

export interface IdentitySessionCreateEntityInterface
  extends Pick<IdentitySession, 'identityId' | 'familyId' | 'tokenHash' | 'expiresAt'> {}

export interface IdentitySessionConsumedInterface extends Pick<IdentitySession, 'identityId' | 'familyId'> {}
