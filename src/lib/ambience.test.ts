import { afterEach, describe, expect, it, vi } from "vitest";
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

function audioDouble(resume: () => Promise<void>) {
  const source = {
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    buffer: null as AudioBuffer | null,
    loop: false,
  };
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const context = {
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    resume,
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => source,
    createGain: () => ({
      ...node(),
      gain: { value: 0, linearRampToValueAtTime: vi.fn() },
    }),
    createBiquadFilter: () => ({
      ...node(),
      type: "",
      frequency: { value: 0 },
      Q: { value: 0 },
    }),
  };
  return { context, source };
}

describe("AudioContext autoplay handling", () => {
  afterEach(async () => {
    const { stopAmbience } = await import("./ambience");
    stopAmbience();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("does not start rain until resume resolves", async () => {
    vi.useFakeTimers();
    let resolveResume!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveResume = resolve;
    });
    const { context, source } = audioDouble(() => pending);
    function AudioContextMock() {
      return context;
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    const { startAmbience } = await import("./ambience");

    const starting = startAmbience("rain");
    expect(source.start).not.toHaveBeenCalled();
    resolveResume();
    await starting;
    expect(source.start).toHaveBeenCalledTimes(1);
  });

  it("does not start after a rejected resume and permits a later retry", async () => {
    vi.useFakeTimers();
    const resume = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    const { context, source } = audioDouble(resume);
    function AudioContextMock() {
      return context;
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    const { startAmbience } = await import("./ambience");

    await startAmbience("rain");
    expect(source.start).not.toHaveBeenCalled();
    await startAmbience("rain");
    expect(source.start).toHaveBeenCalledTimes(1);
  });
});
