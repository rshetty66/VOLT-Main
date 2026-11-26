import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmDialog, dismissToast, getConfirm, getToasts, subscribe, toast } from "../src/ui";

describe("toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    getToasts().forEach((t) => dismissToast(t.id));
    vi.useRealTimers();
  });

  it("shows a message and clears it after a few seconds", () => {
    toast("Saved");
    expect(getToasts().map((t) => t.text)).toEqual(["Saved"]);
    vi.advanceTimersByTime(3600);
    expect(getToasts()).toHaveLength(0);
  });

  it("keeps errors on screen longer than info", () => {
    toast("Bad", "error");
    vi.advanceTimersByTime(5000);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(getToasts()).toHaveLength(0);
  });

  it("keeps only the latest four", () => {
    for (let i = 0; i < 6; i++) toast(`m${i}`, "info", 0);
    expect(getToasts().map((t) => t.text)).toEqual(["m2", "m3", "m4", "m5"]);
  });

  it("tells subscribers when the list changes", () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    toast("x", "info", 0);
    off();
    toast("y", "info", 0);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("confirmDialog", () => {
  it("resolves true on confirm and clears the dialog", async () => {
    const p = confirmDialog("Delete?", "Delete");
    expect(getConfirm()?.confirmLabel).toBe("Delete");
    getConfirm()!.resolve(true);
    expect(await p).toBe(true);
    expect(getConfirm()).toBeNull();
  });

  it("resolves false on cancel", async () => {
    const p = confirmDialog("Remove?");
    getConfirm()!.resolve(false);
    expect(await p).toBe(false);
  });

  it("cancels an earlier question when a new one is asked", async () => {
    const first = confirmDialog("First?");
    const second = confirmDialog("Second?");
    expect(await first).toBe(false);
    expect(getConfirm()?.message).toBe("Second?");
    getConfirm()!.resolve(true);
    expect(await second).toBe(true);
  });
});
