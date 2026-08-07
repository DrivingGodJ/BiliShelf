export function resolveExtensionRuntime(root = globalThis) {
  const browserRuntime = root?.browser?.runtime;
  if (
    browserRuntime?.id &&
    typeof browserRuntime.sendMessage === "function"
  ) {
    return {
      runtime: browserRuntime,
      mode: "promise",
      getLastError: () => "",
    };
  }

  const chromeRuntime = root?.chrome?.runtime;
  if (chromeRuntime?.id && typeof chromeRuntime.sendMessage === "function") {
    return {
      runtime: chromeRuntime,
      mode: "callback",
      getLastError: () => String(root?.chrome?.runtime?.lastError?.message || ""),
    };
  }

  return null;
}

export function sendExtensionRuntimeMessage(transport, message) {
  if (!transport) {
    return Promise.reject(new Error("Extension runtime is unavailable"));
  }

  if (transport.mode === "promise") {
    try {
      return Promise.resolve(transport.runtime.sendMessage(message));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler) => {
      if (settled) return;
      settled = true;
      handler();
    };
    const callback = (response) => {
      const lastError = transport.getLastError();
      if (lastError) {
        finish(() => reject(new Error(lastError)));
        return;
      }
      finish(() => resolve(response));
    };

    try {
      const maybePromise = transport.runtime.sendMessage(message, callback);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((response) => finish(() => resolve(response)))
          .catch((error) => finish(() => reject(error)));
      }
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
