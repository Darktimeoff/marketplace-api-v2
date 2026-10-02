import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('contract', { withBroker: true });

export { setup, teardown };
