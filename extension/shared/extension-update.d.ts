export type ExtensionReleaseChannel = "chrome" | "edge" | "firefox";

export function normalizeExtensionVersion(value: unknown): string | null;
export function compareExtensionVersions(left: unknown, right: unknown): number;
export function resolveExtensionReleaseChannel(options?: {
  userAgent?: string;
  hasGeckoSettings?: boolean;
}): ExtensionReleaseChannel;
export function resolveExtensionUpdateAvailability(options: {
  currentVersion: unknown;
  storeVersion?: unknown;
  storeUrl?: unknown;
  githubVersion?: unknown;
  githubLabel?: unknown;
  githubUrl?: unknown;
}): {
  currentVersion: string;
  storeVersion: string | null;
  githubVersion: string | null;
  latestVersion: string;
  latestLabel: string;
  storeUpdateAvailable: boolean;
  githubUpdateAvailable: boolean;
  updateAvailable: boolean;
  storePending: boolean;
  preferredSource: "store" | "github";
  preferredUrl: string | null;
};
