import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RoleEnum } from '../enum/role.enum.js';
import { LoginPhone } from '../value-object/login-phone.value-object.js';

@Entity('Identity')
@Check('Identity_login_present', `"email" IS NOT NULL OR "loginPhoneFullNumber" IS NOT NULL`)
@Check('Identity_loginPhoneFullNumber_e164', `"loginPhoneFullNumber" ~ '^\\+[1-9][0-9]{7,14}$'`)
@Check('Identity_loginPhoneNationalNumber_fmt', `"loginPhoneNationalNumber" ~ '^[0-9]{4,15}$'`)
@Check('Identity_email_format', `"email" IS NULL OR "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`)
@Check('Identity_activatedAt_ord', `"activatedAt" IS NULL OR "activatedAt" >= "createdAt"`)
@Check('Identity_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Identity {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  // citext, а не varchar: регистронезависимый unique без .toLowerCase() в коде.
  @Column({ type: 'citext', nullable: true, unique: true })
  email: string | null;

  @Column(() => LoginPhone, { prefix: false })
  loginPhone: LoginPhone;

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
}
