import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { QueryFailedError } from 'typeorm';
import type { IdentityTokenResponseInterface } from '@marketplace/contracts-core';
import { IdentityRegisteredEvent } from '@marketplace/messaging-contracts';
import { IdentityRepository } from '../repository/identity.repository.js';
import { PasswordService } from '../service/password.service.js';
import { TokenService } from '../service/token.service.js';
import { IdentityRegisterInput } from '../input/identity-register.input.js';
import { RoleEnum } from '../enum/role.enum.js';
import { Identity } from '../entity/identity.entity.js';
import { KafkaProducerService } from '../../generic/kafka/kafka-producer.service.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class IdentityRegisterCommandHandler {
  private readonly logger = new Logger(IdentityRegisterCommandHandler.name);

  constructor(
    private readonly identities: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async execute(input: IdentityRegisterInput): Promise<IdentityTokenResponseInterface> {
    const passwordHash = await this.passwords.hash(input.password);

    let registered: { identity: Identity; tokenPair: IdentityTokenResponseInterface };

    try {
      registered = await this.register(input, passwordHash);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('An identity with this email or phone already exists');
      }

      throw error;
    }

    await this.publishRegistered(registered.identity);
    return registered.tokenPair;
  }

  @Transactional()
  private async register(input: IdentityRegisterInput, passwordHash: string): Promise<{ identity: Identity; tokenPair: IdentityTokenResponseInterface }> {
    const identity = await this.identities.create({
      email: input.email ?? null,
      loginPhone: {
        countryCode: input.phone?.countryCode ?? null,
        rawNumber: input.phone?.rawNumber ?? null,
        fullNumber: input.phone?.fullNumber ?? null,
        nationalNumber: input.phone?.nationalNumber ?? null,
      },
      passwordHash,
      role: RoleEnum.user,
    });

    return { identity, tokenPair: await this.tokens.createTokenPair(identity) };
  }

  private async publishRegistered(identity: Identity): Promise<void> {
    try {
      await this.kafka.publish(IdentityRegisteredEvent.TOPIC, this.toIdentityRegisteredEvent(identity));
    } catch (error) {
      this.logger.error(`failed to publish ${IdentityRegisteredEvent.TYPE} for identity=${identity.publicId}`, error instanceof Error ? error.stack : String(error));
    }
  }

  private toIdentityRegisteredEvent(identity: Identity): IdentityRegisteredEvent.MessageType {
    return {
      specversion: '1.0',
      id: identity.publicId,
      source: IdentityRegisteredEvent.SOURCE,
      type: IdentityRegisteredEvent.TYPE,
      time: identity.createdAt.toISOString(),
      datacontenttype: 'application/json',
      subject: identity.publicId,
      correlationid: identity.publicId,
      data: {
        identityPublicId: identity.publicId,
        email: identity.email,
        phoneNumber: identity.loginPhone.fullNumber,
      },
    };
  }
}
