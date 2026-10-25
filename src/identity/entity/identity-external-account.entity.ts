import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Identity } from './identity.entity.js';
import { IdentityProviderEnum } from '../enum/identity-provider.enum.js';

@Entity('IdentityExternalAccount')
@Unique('IdentityExternalAccount_provider_subject_key', ['provider', 'subject'])
@Unique('IdentityExternalAccount_identityId_provider_key', ['identityId', 'provider'])
@Check('IdentityExternalAccount_subject_not_blank', `btrim("subject") <> ''`)
export class IdentityExternalAccount {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  identityId: number;

  @Column({ type: 'enum', enum: IdentityProviderEnum, enumName: 'IdentityProviderEnum' })
  provider: IdentityProviderEnum;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => Identity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'identityId' })
  identity: Identity;
}

export interface IdentityExternalAccountCreateEntityInterface
  extends Pick<IdentityExternalAccount, 'identityId' | 'provider' | 'subject'> {}
