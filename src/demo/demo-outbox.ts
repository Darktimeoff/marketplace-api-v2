// TODO(hw-22): remove after homework
import { run, report } from './demo-harness.js';

await run(async (demo) => {
  const key = demo.newKey();
  const statuses = await Promise.all([demo.placeOrder(key), demo.placeOrder(key)]);

  await demo.relay.relay();
  const counts = await demo.waitFor((c) => c.processed >= 1 && c.deliveries >= 1);
  await demo.settle(2000);
  const final = await demo.counts();

  return report(
    {
      requests: statuses.length,
      accepted: statuses.filter((status) => status === 202).length,
      orders: final.orders,
      outbox: final.outbox,
      published: final.published,
      deliveries: final.deliveries,
      effect: final.effect,
      processed: final.processed,
    },
    [
      ['both requests accepted', statuses.every((status) => status === 202)],
      ['one order for one key', final.orders === 1],
      ['one event for one order', final.outbox === 1 && final.published === 1],
      ['delivered', counts.deliveries >= 1],
      ['one effect', final.effect === 1 && final.processed === 1],
    ],
  );
});
