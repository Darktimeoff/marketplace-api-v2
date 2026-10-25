import { createDbLifecycle } from './container-lifecycle.js';
import { testWorkers } from './test-workers.js';

const { setup, teardown } = createDbLifecycle('e2e', { withBroker: true, withKafka: true, withTemporal: true, withRedis: true, sets: testWorkers() });

export { setup, teardown };
