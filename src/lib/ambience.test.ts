import { describe, expect, it } from "vitest";
import { brownStep } from "./ambience";

describe("brownStep", () => {
  it("integrates white noise and stays clamped to [-1, 1]", () => {
    let last = 0;
    for (let i = 0; i < 5000; i++) {
      const white = i % 2 === 0 ? 1 : -1;
      last = brownStep(last, white);
      expect(last).toBeGreaterThanOrEqual(-1);
      expect(last).toBeLessThanOrEqual(1);
    }
  });

  it("a constant push converges toward the clamp, never beyond", () => {
    let last = 0;
    for (let i = 0; i < 10000; i++) last = brownStep(last, 1);
    expect(last).toBeLessThanOrEqual(1);
    expect(last).toBeGreaterThan(0.5);
  });

  it("zero input decays toward silence", () => {
    let last = 0.8;
    for (let i = 0; i < 2000; i++) last = brownStep(last, 0);
    expect(Math.abs(last)).toBeLessThan(0.01);
  });
});
