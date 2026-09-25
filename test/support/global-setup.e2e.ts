import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('e2e');

export { setup, teardown };
