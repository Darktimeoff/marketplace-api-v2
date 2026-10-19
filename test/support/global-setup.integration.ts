import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('integration', { withBroker: true, withRedis: true });

export { setup, teardown };
