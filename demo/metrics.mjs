// TODO(hw-29): remove after homework
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build, buyer, placeOrder, report, startApp, stockedOffer, stopApp } from './lib/app.mjs';

const okOrders = 40;
const failingOrders = 15;
const distinctIds = 100;
const topFiniteBucket = '30';

function parseMetrics(text) {
  const samples = [];

  for (const line of text.split('\n')) {
    const match = line.match(/^([a-zA-Z_:][\w:]*)(?:\{(.*)\})? (\S+)$/);

    if (match) {
      const labels = Object.fromEntries([...(match[2] ?? '').matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
      samples.push({ name: match[1], labels, value: Number(match[3]) });
    }
  }

  return samples;
}

async function scrape(app) {
  return parseMetrics(await (await fetch(app.metricsUrl)).text());
}

function sum(samples, name, matches) {
  return samples.filter((sample) => sample.name === name && matches(sample.labels)).reduce((total, sample) => total + sample.value, 0);
}

async function getOrder(app, token, id) {
  await (await fetch(`${app.url}/order/${id}`, { headers: { authorization: `Bearer ${token}` } })).arrayBuffer();
}

function isOrderPost(labels) {
  return labels.method === 'POST' && labels.route === '/order';
}

build();
const offer = await stockedOffer();
const app = await startApp(join(mkdtempSync(join(tmpdir(), 'demo-metrics-')), 'app.log'));

try {
  const token = await buyer(app, offer);

  const before = await scrape(app);
  let sentOk = 0;
  let sentFail = 0;

  for (let index = 0; index < okOrders + failingOrders; index++) {
    const response = await placeOrder(app, token, offer, index < failingOrders ? { 'x-demo-fail': '1' } : {});
    await response.arrayBuffer();
    sentOk += Number(response.status === 202);
    sentFail += Number(response.status >= 500);
  }

  const after = await scrape(app);

  await getOrder(app, token, randomUUID());
  const seriesBefore = (await scrape(app)).filter((sample) => sample.name === 'http_requests_total').length;

  for (let index = 0; index < distinctIds; index++) {
    await getOrder(app, token, randomUUID());
  }

  const final = await scrape(app);
  const seriesAfter = final.filter((sample) => sample.name === 'http_requests_total').length;

  const count = sum(final, 'http_request_duration_seconds_count', isOrderPost);
  const topBucket = sum(final, 'http_request_duration_seconds_bucket', (labels) => isOrderPost(labels) && labels.le === topFiniteBucket);

  const values = {
    'sent-ok': sentOk,
    'sent-fail': sentFail,
    'counter-delta': sum(after, 'http_requests_total', isOrderPost) - sum(before, 'http_requests_total', isOrderPost),
    'errors-delta':
      sum(after, 'http_requests_total', (labels) => isOrderPost(labels) && labels.status.startsWith('5')) -
      sum(before, 'http_requests_total', (labels) => isOrderPost(labels) && labels.status.startsWith('5')),
    'top-bucket-le': Number(topFiniteBucket),
    'above-top-bucket': count - topBucket,
    'distinct-ids': distinctIds,
    'series-before': seriesBefore,
    'series-after': seriesAfter,
  };

  report(values, [
    ['sent-ok+sent-fail>=50', values['sent-ok'] + values['sent-fail'] >= 50],
    ['counter-delta=sent-ok+sent-fail', values['counter-delta'] === values['sent-ok'] + values['sent-fail']],
    ['errors-delta=sent-fail', values['errors-delta'] === values['sent-fail']],
    ['above-top-bucket=0', values['above-top-bucket'] === 0],
    ['series-after=series-before', values['series-after'] === values['series-before']],
  ]);
} finally {
  await stopApp(app);
}
