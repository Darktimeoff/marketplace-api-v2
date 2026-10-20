import { describe, expect, it } from 'vitest';
import { missingEnvironmentSecrets } from '../../../src/generic/secret-manager/missing-environment-secrets.js';
import { SECRET_NAMES } from '../../../src/generic/secret-manager/secret-names.constant.js';

describe('missingEnvironmentSecrets', () => {
  const all = Object.fromEntries(SECRET_NAMES.map((name) => [name, 'value']));

  it('names every secret missing from the environment when the vault is skipped', () => {
    expect(missingEnvironmentSecrets({ ...all, SKIP_VAULT: '1', JWT_PRIVATE_KEY: '', REFRESH_TOKEN_PEPPER: undefined })).toEqual(['JWT_PRIVATE_KEY', 'REFRESH_TOKEN_PEPPER']);
  });

  it('passes when every secret is exported', () => {
    expect(missingEnvironmentSecrets({ ...all, SKIP_VAULT: '1' })).toEqual([]);
  });

  it('leaves the check to the vault when it is not skipped', () => {
    expect(missingEnvironmentSecrets({})).toEqual([]);
  });
});
