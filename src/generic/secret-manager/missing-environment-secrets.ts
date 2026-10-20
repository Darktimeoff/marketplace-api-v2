import { SECRET_NAMES } from './secret-names.constant.js';
import type { SecretsInterface } from './secrets.interface.js';

export function missingEnvironmentSecrets(environment: NodeJS.ProcessEnv): (keyof SecretsInterface)[] {
  if (environment.SKIP_VAULT !== '1') {
    return [];
  }

  return SECRET_NAMES.filter((name) => !environment[name]);
}
