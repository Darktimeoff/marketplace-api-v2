import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('integration', { withBroker: true });

export { setup, teardown };
