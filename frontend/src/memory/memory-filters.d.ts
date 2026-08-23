import type { DateParts, MemoryVideo } from "./types";

export function shanghaiDateParts(timestamp: number): DateParts;
export function shanghaiDateKey(timestamp: number): string;
export function normalizeSearchText(value: unknown): string;
export function filterMemories(
  items: MemoryVideo[],
  filter?: {
    query?: string;
    year?: number | string;
    month?: number | string;
    day?: number | string;
    activeOnly?: boolean;
  },
): MemoryVideo[];
export function pickRandomMemory(
  items: MemoryVideo[],
  previousKey?: string,
  random?: () => number,
): MemoryVideo | null;
export function memoriesOnThisDay(items: MemoryVideo[], now?: number): MemoryVideo[];
