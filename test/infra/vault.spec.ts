import { describe, expect, it } from 'vitest';
import { SECRET_NAMES } from '../../src/generic/secret-manager/secret-names.constant.js';
import {
  POD_VAULT_VARIABLE_NAMES,
  VAULT_SECRET_NAMES,
  VAULT_VARIABLE_NAMES,
  missingPodVaultVariables,
  missingVaultVariables,
  pickVaultSecrets,
} from '../../infra/vault.js';

describe('infra vault variables', () => {
  function aFullEnvironment(): NodeJS.ProcessEnv {
    return Object.fromEntries(VAULT_VARIABLE_NAMES.map((name) => [name, `value-of-${name}`]));
  }

  it('puts every secret the app reads into the Kubernetes Secret, and nothing else', () => {
    expect([...VAULT_SECRET_NAMES].sort()).toEqual([...SECRET_NAMES].sort());
  });

  it('names each variable that is missing or blank, one at a time', () => {
    for (const name of VAULT_VARIABLE_NAMES) {
      expect(missingVaultVariables({ ...aFullEnvironment(), [name]: undefined })).toEqual([name]);
      expect(missingVaultVariables({ ...aFullEnvironment(), [name]: '  ' })).toEqual([name]);
    }

    expect(missingVaultVariables(aFullEnvironment())).toEqual([]);
  });

  it('picks only the app secrets, without the Pulumi passphrase', () => {
    const secrets = pickVaultSecrets(aFullEnvironment());

    expect(Object.keys(secrets).sort()).toEqual([...VAULT_SECRET_NAMES].sort());
    expect(secrets).not.toHaveProperty('PULUMI_CONFIG_PASSPHRASE');
  });

  it('asks only for the identity, the project and the passphrase when the pods read the vault themselves', () => {
    const environment = Object.fromEntries(POD_VAULT_VARIABLE_NAMES.map((name) => [name, `value-of-${name}`]));

    for (const name of POD_VAULT_VARIABLE_NAMES) {
      expect(missingPodVaultVariables({ ...environment, [name]: undefined })).toEqual([name]);
      expect(missingPodVaultVariables({ ...environment, [name]: '  ' })).toEqual([name]);
    }

    expect(missingPodVaultVariables(environment)).toEqual([]);
    expect(POD_VAULT_VARIABLE_NAMES).not.toContain('DBPASSWORD');
  });
});
