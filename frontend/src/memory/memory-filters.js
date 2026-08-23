const SHANGHAI_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function shanghaiDateParts(timestamp) {
  const parts = SHANGHAI_FORMATTER.formatToParts(new Date(Number(timestamp)));
  const read = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

export function shanghaiDateKey(timestamp) {
  const { year, month, day } = shanghaiDateParts(timestamp);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeSearchText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

export function filterMemories(items, filter = {}) {
  const query = normalizeSearchText(filter.query);
  const year = Number(filter.year) || 0;
  const month = Number(filter.month) || 0;
  const day = Number(filter.day) || 0;
  const activeOnly = filter.activeOnly !== false;

  return items.filter((item) => {
    if (activeOnly && item.active === false) return false;
    const date = shanghaiDateParts(item.favoriteAt);
    if (year && date.year !== year) return false;
    if (month && date.month !== month) return false;
    if (day && date.day !== day) return false;
    if (!query) return true;

    const haystack = normalizeSearchText([
      item.title,
      item.uploader,
      item.description,
      item.bvid,
    ].join(" "));
    return query.split(" ").every((token) => haystack.includes(token));
  });
}

export function pickRandomMemory(items, previousKey = "", random = Math.random) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (items.length === 1) return items[0];

  const candidates = previousKey
    ? items.filter((item) => item.key !== previousKey)
    : items;
  const pool = candidates.length ? candidates : items;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index] ?? null;
}

export function pickRandomMemories(
  items,
  count = 4,
  excludedKeys = [],
  random = Math.random,
) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const limit = Math.max(0, Math.min(items.length, Math.floor(Number(count) || 0)));
  if (!limit) return [];

  const seenKeys = new Set();
  const uniqueItems = items.filter((item) => {
    if (!item?.key || seenKeys.has(item.key)) return false;
    seenKeys.add(item.key);
    return true;
  });
  const excluded = new Set(excludedKeys);

  function shuffled(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  const fresh = shuffled(uniqueItems.filter((item) => !excluded.has(item.key)));
  const previous = shuffled(uniqueItems.filter((item) => excluded.has(item.key)));
  return [...fresh, ...previous].slice(0, limit);
}

export function memoriesOnThisDay(items, now = Date.now()) {
  const today = shanghaiDateParts(now);
  return items.filter((item) => {
    if (item.active === false) return false;
    const date = shanghaiDateParts(item.favoriteAt);
    return date.month === today.month && date.day === today.day && date.year !== today.year;
  });
}
