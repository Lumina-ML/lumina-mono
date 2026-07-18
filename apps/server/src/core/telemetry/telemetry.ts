export interface Labels {
  [key: string]: string | number | undefined;
}

export interface Telemetry {
  histogram(name: string, value: number, labels?: Labels): void;
  counter(name: string, delta?: number, labels?: Labels): void;
  gauge(name: string, value: number, labels?: Labels): void;
}
