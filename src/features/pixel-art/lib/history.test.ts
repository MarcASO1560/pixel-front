import { describe, expect, it } from "vitest";

import { createHistory } from "./history";

describe("snapshot history", () => {
  it("starts at the initial snapshot with no undo or redo", () => {
    const history = createHistory("initial");

    expect(history.current).toBe("initial");
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBe(history);
    expect(history.redo()).toBe(history);
  });

  it("pushes, undoes, and redoes without mutating previous histories", () => {
    const initial = createHistory(0);
    const pushed = initial.push(1).push(2);
    const undone = pushed.undo();
    const redone = undone.redo();

    expect(initial.current).toBe(0);
    expect(initial.canUndo).toBe(false);
    expect(pushed.current).toBe(2);
    expect(pushed.canUndo).toBe(true);
    expect(pushed.canRedo).toBe(false);
    expect(undone.current).toBe(1);
    expect(undone.canUndo).toBe(true);
    expect(undone.canRedo).toBe(true);
    expect(redone.current).toBe(2);
    expect(redone.canRedo).toBe(false);
  });

  it("treats equal pushes as no-ops using configurable equality", () => {
    const history = createHistory(
      { pixels: ["#FFFFFF"] },
      { equals: (left, right) => left.pixels.join() === right.pixels.join() },
    );
    const equalPush = history.push({ pixels: ["#FFFFFF"] });

    expect(equalPush).toBe(history);
    expect(equalPush.canUndo).toBe(false);
  });

  it("keeps the redo branch for a no-op and discards it for a new push", () => {
    const undone = createHistory(0).push(1).push(2).undo();
    const noOp = undone.push(1);
    const branched = noOp.push(3);

    expect(noOp).toBe(undone);
    expect(noOp.canRedo).toBe(true);
    expect(branched.current).toBe(3);
    expect(branched.canRedo).toBe(false);
    expect(branched.undo().current).toBe(1);
  });

  it("keeps at most 100 undo entries by default", () => {
    let history = createHistory(0);

    for (let snapshot = 1; snapshot <= 101; snapshot += 1) {
      history = history.push(snapshot);
    }

    let undoCount = 0;
    while (history.canUndo) {
      history = history.undo();
      undoCount += 1;
    }

    expect(undoCount).toBe(100);
    expect(history.current).toBe(1);
  });

  it("supports a custom limit", () => {
    const history = createHistory("a", { limit: 2 })
      .push("b")
      .push("c")
      .push("d")
      .undo()
      .undo();

    expect(history.current).toBe("b");
    expect(history.canUndo).toBe(false);
  });

  it("clears undo and redo while retaining or replacing the current snapshot", () => {
    const history = createHistory(0).push(1).push(2).undo();
    const retained = history.clear();
    const replaced = history.clear(9);

    expect(retained.current).toBe(1);
    expect(retained.canUndo).toBe(false);
    expect(retained.canRedo).toBe(false);
    expect(replaced.current).toBe(9);
    expect(replaced.canUndo).toBe(false);
    expect(replaced.canRedo).toBe(false);
  });

  it("rejects invalid limits", () => {
    expect(() => createHistory(0, { limit: 0 })).toThrow(RangeError);
    expect(() => createHistory(0, { limit: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it("does not mutate frozen snapshots", () => {
    const first = Object.freeze({ pixels: Object.freeze([null, "#FFFFFF"]) });
    const second = Object.freeze({ pixels: Object.freeze(["#000000", "#FFFFFF"]) });
    const history = createHistory(first).push(second).undo().redo();

    expect(history.current).toBe(second);
    expect(first.pixels).toEqual([null, "#FFFFFF"]);
    expect(second.pixels).toEqual(["#000000", "#FFFFFF"]);
  });
});
