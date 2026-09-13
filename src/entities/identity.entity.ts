import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RoleEnum } from './enums.js';
import { Phone } from './phone.entity.js';
import type { User } from './user.entity.js';

@Entity('Identity')
@Check('Identity_login_present', `"email" IS NOT NULL OR "phoneId" IS NOT NULL`)
@Check('Identity_email_format', `"email" IS NULL OR "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`)
@Check('Identity_activatedAt_ord', `"activatedAt" IS NULL OR "activatedAt" >= "createdAt"`)
@Check('Identity_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Identity {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  // citext, а не varchar: регистронезависимый unique без .toLowerCase() в коде.
  @Column({ type: 'citext', nullable: true, unique: true })
  email: string | null;

  @Column({ type: 'integer', nullable: true })
  phoneId: number | null;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: RoleEnum, enumName: 'RoleEnum', default: RoleEnum.user })
  role: RoleEnum;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // RESTRICT: телефон — способ логина, удалять его из-под живого аккаунта нельзя.
  @OneToOne(() => Phone, (phone) => phone.identity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'phoneId' })
  phone: Phone | null;

  @OneToOne('User', (user: User) => user.identity)
  user: User | null;
}
