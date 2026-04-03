import * as Comlink from "comlink";
import type { RuntimeWorkerEvents } from "@gitinspect/pi/agent/runtime-worker-types";

declare const ComlinkWorker: new <T>(scriptURL: URL, options?: WorkerOptions) => Comlink.Remote<T>;

let workerApi: Comlink.Remote<typeof import("./runtime-worker")> | undefined;

export function getRuntimeWorker(): Comlink.Remote<typeof import("./runtime-worker")> {
  workerApi ??= new ComlinkWorker<typeof import("./runtime-worker")>(
    new URL("./runtime-worker", import.meta.url),
    {
      name: "gitinspect-runtime-worker",
      type: "module",
    },
  );

  return workerApi;
}

export function createRuntimeWorkerEvents(sink: RuntimeWorkerEvents): RuntimeWorkerEvents {
  return Comlink.proxy(sink);
}
