import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('integration', { withBroker: true, withKafka: true, withTemporal: true, withRedis: true });

export { setup, teardown };
