export interface IdentityJwkResponseInterface {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
  alg: string;
  use: string;
}

export interface IdentityJwksResponseInterface {
  keys: IdentityJwkResponseInterface[];
}
