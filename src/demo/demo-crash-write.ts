// TODO(hw-22): remove after homework
import { run, report } from './demo-harness.js';
import { OrderOutboxRepository } from '../order/repository/order-outbox.repository.js';

await run(async (demo) => {
  const repository = OrderOutboxRepository.prototype;
  const create = repository.create;
  repository.create = async function (this: OrderOutboxRepository, ...args: Parameters<typeof create>) {
    await create.apply(this, args);
    throw new Error('demo: business write crashed after the outbox row was inserted');
  };

  const status = await demo.placeOrder(demo.newKey());
  repository.create = create;

  await demo.relay.relay();
  await demo.settle(5000);
  const final = await demo.counts();

  return report(
    {
      'write-failed': status >= 500 ? 1 : 0,
      orders: final.orders,
      outbox: final.outbox,
      published: final.published,
      deliveries: final.deliveries,
      effect: final.effect,
    },
    [
      ['the write failed', status >= 500],
      ['no order', final.orders === 0],
      ['no outbox row survived the rollback', final.outbox === 0],
      ['nothing published or delivered', final.published === 0 && final.deliveries === 0],
      ['no effect', final.effect === 0],
    ],
  );
});
