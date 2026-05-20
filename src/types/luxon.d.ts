/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'luxon' {
  export class DateTime {
    static fromISO(iso: string, options?: any): any;
    static now(): any;
    toFormat(fmt: string): string;
    toLocaleString(options?: any): string;
    diff(other: any, unit?: string | string[]): any;
    as(unit: string): number;
    toISODate(): string;
    plus(duration: any): DateTime;
    minus(duration: any): DateTime;
    setZone(zone: string): DateTime;
  }
}
