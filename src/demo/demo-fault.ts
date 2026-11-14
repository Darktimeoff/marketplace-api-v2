// TODO(hw-29): remove after homework
import type { IncomingMessage } from 'node:http';
import { ClsServiceManager } from 'nestjs-cls';

const demoFaultKey = 'demoFault';

export class DemoFaultException extends Error {}

export function markDemoFault(request: IncomingMessage): void {
  if (process.env.DEMO_FAULTS === '1' && request.headers['x-demo-fail'] === '1') {
    ClsServiceManager.getClsService().set(demoFaultKey, true);
  }
}

export function failIfDemoFault(): void {
  const cls = ClsServiceManager.getClsService();

  if (cls.isActive() && cls.get(demoFaultKey) === true) {
    throw new DemoFaultException('demo fault: x-demo-fail on DEMO_FAULTS=1');
  }
}
