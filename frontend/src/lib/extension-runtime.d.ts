type ExtensionRuntime = {
  id?: string;
  sendMessage: (
    message: unknown,
    callback?: (response?: unknown) => void,
  ) => Promise<unknown> | void;
};

export type ExtensionRuntimeTransport = {
  runtime: ExtensionRuntime;
  mode: "promise" | "callback";
  getLastError: () => string;
};

export function resolveExtensionRuntime(
  root?: typeof globalThis,
): ExtensionRuntimeTransport | null;

export function sendExtensionRuntimeMessage(
  transport: ExtensionRuntimeTransport | null,
  message: unknown,
): Promise<unknown>;
