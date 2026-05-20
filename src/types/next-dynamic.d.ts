/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'next/dynamic' {
  import type { ComponentType } from 'react';

  const dynamic: (
    loader: (...args: never[]) => unknown,
    options?: Record<string, unknown>
  ) => ComponentType<any>;

  export default dynamic;
}
