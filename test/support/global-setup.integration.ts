import { createDbLifecycle } from './container-lifecycle.js';

const { setup, teardown } = createDbLifecycle('integration');

export { setup, teardown };
