import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('integration', { withRedis: true });

export { setup, teardown };
