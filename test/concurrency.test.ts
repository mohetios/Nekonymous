import { describe, expect, it } from "vitest";
import { mapBounded } from "../src/utils/concurrency";

describe("mapBounded", () => {
  it("preserves input order while respecting the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapBounded([30, 5, 20, 1], 2, async (delay) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return delay;
    });

    expect(results).toEqual([30, 5, 20, 1]);
    expect(maxActive).toBe(2);
  });

  it("rejects invalid concurrency limits", async () => {
    await expect(mapBounded([1], 0, async (value) => value)).rejects.toThrow(
      RangeError
    );
  });
});
