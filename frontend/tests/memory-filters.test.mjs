import assert from "node:assert/strict";
import test from "node:test";
import {
  filterMemories,
  memoriesOnThisDay,
  pickRandomMemory,
  shanghaiDateKey,
} from "../src/memory/memory-filters.js";

const items = [
  {
    key: "one",
    title: "南京散步摄影",
    uploader: "阿爪",
    description: "夜晚与街道",
    bvid: "BV1ONE",
    favoriteAt: Date.parse("2024-08-23T01:00:00Z"),
    active: true,
  },
  {
    key: "two",
    title: "汽车曲面教程",
    uploader: "Alias Lab",
    description: "Class A surface",
    bvid: "BV1TWO",
    favoriteAt: Date.parse("2023-05-12T01:00:00Z"),
    active: true,
  },
  {
    key: "archived",
    title: "已取消收藏",
    uploader: "旧 UP",
    description: "",
    bvid: "BV1OLD",
    favoriteAt: Date.parse("2024-08-23T03:00:00Z"),
    active: false,
  },
];

test("filters by Shanghai calendar date and multiple search tokens", () => {
  assert.equal(
    filterMemories(items, { year: 2024, month: 8, day: 23 }).map((item) => item.key).join(","),
    "one",
  );
  assert.equal(filterMemories(items, { query: "汽车 alias" })[0]?.key, "two");
  assert.equal(filterMemories(items, { query: "BV1ONE" })[0]?.key, "one");
});

test("uses Asia/Shanghai rather than UTC for date keys", () => {
  assert.equal(shanghaiDateKey(Date.parse("2024-08-22T16:30:00Z")), "2024-08-23");
});

test("random memory avoids the previous item when alternatives exist", () => {
  assert.equal(pickRandomMemory(items.slice(0, 2), "one", () => 0)?.key, "two");
  assert.equal(pickRandomMemory([], "", () => 0), null);
});

test("finds memories from the same month and day in earlier years", () => {
  const now = Date.parse("2026-08-23T04:00:00Z");
  assert.deepEqual(memoriesOnThisDay(items, now).map((item) => item.key), ["one"]);
});
