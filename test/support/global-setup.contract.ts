import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('contract');

export { setup, teardown };
