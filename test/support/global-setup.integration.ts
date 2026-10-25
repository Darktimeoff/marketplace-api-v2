import { createDbLifecycle } from './container-lifecycle.js';
import { testWorkers } from './test-workers.js';

const { setup, teardown } = createDbLifecycle('integration', { withRedis: true, sets: testWorkers() });

export { setup, teardown };
