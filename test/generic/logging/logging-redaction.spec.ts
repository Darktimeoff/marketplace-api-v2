import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { REDACTED_PATHS } from '../../../src/generic/logging/logging.module.js';

describe('log redaction', () => {
  const token = 'BEARER-MARKER-7f3a';
  const password = 'PASSWORD-MARKER-9c1e';

  function logged(write: (logger: pino.Logger) => void): string {
    let output = '';
    const stream = new Writable({ write(chunk: Buffer, _encoding, done) { output += chunk.toString(); done(); } });
    write(pino({ redact: REDACTED_PATHS }, stream));
    return output;
  }

  it('hides the authorization header and cookies of a logged request', () => {
    const output = logged((logger) => logger.info({ req: { method: 'POST', headers: { authorization: `Bearer ${token}`, cookie: `refresh=${token}` } } }, 'request'));

    expect(output).not.toContain(token);
    expect(output).toContain('"method":"POST"');
  });

  it('hides a password at the top level, in a logged body and one level deeper', () => {
    const output = logged((logger) => {
      logger.info({ password }, 'top level');
      logger.info({ body: { login: 'jane@example.com', password } }, 'login body');
      logger.info({ input: { credentials: { password } } }, 'nested');
    });

    expect(output).not.toContain(password);
    expect(output).toContain('jane@example.com');
  });

  it('hides access and refresh tokens in a logged response', () => {
    const output = logged((logger) => logger.info({ result: { accessToken: token, refreshToken: token, expiresIn: 900 } }, 'tokens'));

    expect(output).not.toContain(token);
    expect(output).toContain('"expiresIn":900');
  });
});
