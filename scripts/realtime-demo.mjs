import { io } from 'socket.io-client';

const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
const orderA = Number(process.env.ORDER_ID_A ?? 1);
const orderB = Number(process.env.ORDER_ID_B ?? 2);
const buyerA = Number(process.env.BUYER_ID_A ?? 3);
const buyerB = Number(process.env.BUYER_ID_B ?? 4);
const status = process.env.ORDER_STATUS ?? 'preparing';
const timeoutMs = Number(process.env.EVENT_TIMEOUT_MS ?? 3000);
const sameRoom = process.argv.includes('--same-room');

const clientA = io(apiUrl, { auth: { userId: buyerA }, timeout: timeoutMs });
const clientB = io(apiUrl, {
  auth: { userId: sameRoom ? buyerA : buyerB },
  timeout: timeoutMs,
});
let eventTimer;
let joinTimerA;
let joinTimerB;

function waitForConnect(client) {
  return new Promise((resolve, reject) => {
    if (client.connected) return resolve();
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });
}

function join(client, id, timerRef) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Join timed out for order ${id}`)), timeoutMs);
    timerRef.set(timer);
    client.timeout(timeoutMs).emit('join', { orderId: id }, (error, ack) => {
      clearTimeout(timer);
      if (error) return reject(error);
      if (ack?.joined) return resolve();
      reject(new Error(`Unable to join order ${id}`));
    });
  });
}

try {
  await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);
  await Promise.all([
    join(clientA, orderA, { set: (timer) => { joinTimerA = timer; } }),
    join(clientB, sameRoom ? orderA : orderB, { set: (timer) => { joinTimerB = timer; } }),
  ]);

  let receivedA = false;
  let receivedB = false;
  let resolveEvents;
  const bothEvents = new Promise((resolve) => {
    resolveEvents = resolve;
    eventTimer = setTimeout(resolve, timeoutMs);
  });
  clientA.on('order.status', (event) => {
    if (event.orderId === orderA) receivedA = true;
    if (receivedA && receivedB) resolveEvents();
  });
  clientB.on('order.status', (event) => {
    if (event.orderId === orderA) receivedB = true;
    if (receivedA && receivedB) resolveEvents();
  });

  const response = await fetch(`${apiUrl}/orders/${orderA}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: buyerA, status }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Status update failed with HTTP ${response.status}: ${await response.text()}`);
  }

  await bothEvents;
  console.log(`A_RECEIVED=${Number(receivedA)}`);
  console.log(`B_RECEIVED=${Number(receivedB)}`);
  process.exitCode = receivedA && receivedB === sameRoom ? 0 : 1;
} catch (error) {
  console.error(error.message);
  console.log('A_RECEIVED=0');
  console.log('B_RECEIVED=0');
  process.exitCode = 1;
} finally {
  clearTimeout(eventTimer);
  clearTimeout(joinTimerA);
  clearTimeout(joinTimerB);
  clientA.disconnect();
  clientB.disconnect();
}
