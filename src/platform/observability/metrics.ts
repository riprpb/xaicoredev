export interface MetricSnapshot {
  counters: Readonly<Record<string, number>>;
  gauges: Readonly<Record<string, number>>;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();

  increment(name: string, amount = 1): void {
    validateMetric(name, amount);
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  setGauge(name: string, value: number): void {
    validateMetric(name, value);
    this.gauges.set(name, value);
  }

  snapshot(): MetricSnapshot {
    return {
      counters: Object.fromEntries([...this.counters.entries()].sort()),
      gauges: Object.fromEntries([...this.gauges.entries()].sort()),
    };
  }
}

function validateMetric(name: string, value: number): void {
  if (!/^[a-z][a-z0-9_.]*$/.test(name)) throw new Error('Metric name is invalid');
  if (!Number.isFinite(value)) throw new Error('Metric value must be finite');
}
