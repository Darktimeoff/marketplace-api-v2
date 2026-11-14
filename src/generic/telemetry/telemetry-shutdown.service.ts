import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ProxyTracerProvider, trace, type TracerProvider } from '@opentelemetry/api';

@Injectable()
export class TelemetryShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    const registered = trace.getTracerProvider();
    const provider: TracerProvider & { shutdown?: () => Promise<void> } = registered instanceof ProxyTracerProvider ? registered.getDelegate() : registered;

    await provider.shutdown?.();
  }
}
