import { parentPort } from 'node:worker_threads';

const port = parentPort;
if (!port) throw new Error('audit worker must run in a worker thread');

export const self = {
  postMessage: (message: unknown, transfer?: Transferable[]) => port.postMessage(message, transfer as never),
  addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
    port.on(type, (data: unknown) => listener({ data }));
  },
  removeEventListener: (type: string, listener: (...args: unknown[]) => void) => {
    port.off(type, listener);
  },
  crossOriginIsolated: false as boolean,
};
