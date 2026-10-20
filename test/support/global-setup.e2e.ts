import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('e2e', { withBroker: true, withKafka: true, withTemporal: true, withRedis: true });

export { setup, teardown };
