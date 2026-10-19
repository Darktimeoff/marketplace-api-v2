// TODO(hw-22): remove after homework
import { run, report } from './demo-harness.js';
import { OrderOutboxRepository } from '../order/repository/order-outbox.repository.js';

await run(async (demo) => {
  const status = await demo.placeOrder(demo.newKey());

  const repository = OrderOutboxRepository.prototype;
  const markPublished = repository.markPublished;
  let crashes = 0;
  repository.markPublished = async function (this: OrderOutboxRepository, ...args: Parameters<typeof markPublished>) {
    if (crashes === 0) {
      crashes += 1;
      throw new Error('demo: relay crashed after sending, before UPDATE publishedAt');
    }
    return markPublished.apply(this, args);
  };

  await demo.relay.relay();
  const afterCrash = await demo.counts();
  await demo.waitFor((c) => c.deliveries >= 1);
  await demo.relay.relay();
  repository.markPublished = markPublished;

  await demo.waitFor((c) => c.deliveries >= 2 && c.processed >= 1);
  await demo.settle(2000);
  const final = await demo.counts();

  return report(
    {
      'relay-crashes': crashes,
      'published-after-crash': afterCrash.published,
      published: final.published,
      deliveries: final.deliveries,
      applied: final.applied,
      effect: final.effect,
      processed: final.processed,
    },
    [
      ['order accepted', status === 202],
      ['the crash left the row unpublished', crashes === 1 && afterCrash.published === 0],
      ['published after the retry', final.published === 1],
      ['delivered at least twice', final.deliveries >= 2],
      ['applied once', final.applied === 1 && final.effect === 1 && final.processed === 1],
    ],
  );
});
