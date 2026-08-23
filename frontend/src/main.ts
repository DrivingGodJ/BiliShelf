const runtimeTarget = import.meta.env.VITE_RUNTIME_TARGET;

if (runtimeTarget === "memory-web") {
  void import("./memory-main");
} else {
  void import("./manager-main");
}
