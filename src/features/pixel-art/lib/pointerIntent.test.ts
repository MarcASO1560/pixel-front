import { describe, expect, it } from "vitest";

import { getImagePointerIntent, type ImagePointerIntentInput } from "./pointerIntent";

type PointerCase = Omit<ImagePointerIntentInput, "startsOnArtboard"> & {
  expected: ReturnType<typeof getImagePointerIntent>;
  label: string;
};

const pointerCases: PointerCase[] = [
  {
    label: "primary down",
    button: 0,
    buttons: 1,
    shiftPressed: false,
    spacePressed: false,
    expected: "paint",
  },
  {
    label: "held primary move",
    button: -1,
    buttons: 1,
    shiftPressed: false,
    spacePressed: false,
    expected: "paint",
  },
  {
    label: "Shift + primary down without Space",
    button: 0,
    buttons: 1,
    shiftPressed: true,
    spacePressed: false,
    expected: "paint",
  },
  {
    label: "Space + primary down",
    button: 0,
    buttons: 1,
    shiftPressed: false,
    spacePressed: true,
    expected: "pan",
  },
  {
    label: "Space + held primary move",
    button: -1,
    buttons: 1,
    shiftPressed: false,
    spacePressed: true,
    expected: "pan",
  },
  {
    label: "Shift + Space + primary down",
    button: 0,
    buttons: 1,
    shiftPressed: true,
    spacePressed: true,
    expected: "rotate",
  },
  {
    label: "Shift + Space + held primary move",
    button: -1,
    buttons: 1,
    shiftPressed: true,
    spacePressed: true,
    expected: "rotate",
  },
  {
    label: "middle down reported by button",
    button: 1,
    buttons: 0,
    shiftPressed: false,
    spacePressed: false,
    expected: "pan",
  },
  {
    label: "middle down reported by buttons",
    button: -1,
    buttons: 4,
    shiftPressed: false,
    spacePressed: false,
    expected: "pan",
  },
  {
    label: "Shift + middle down reported by button",
    button: 1,
    buttons: 0,
    shiftPressed: true,
    spacePressed: false,
    expected: "rotate",
  },
  {
    label: "Shift + middle down reported by buttons",
    button: -1,
    buttons: 4,
    shiftPressed: true,
    spacePressed: false,
    expected: "rotate",
  },
  {
    label: "Shift + Space + middle down",
    button: 1,
    buttons: 4,
    shiftPressed: true,
    spacePressed: true,
    expected: "rotate",
  },
  {
    label: "middle takes priority while primary is also held",
    button: 0,
    buttons: 5,
    shiftPressed: false,
    spacePressed: false,
    expected: "pan",
  },
  {
    label: "Shift + middle takes rotation priority while primary is also held",
    button: 0,
    buttons: 5,
    shiftPressed: true,
    spacePressed: false,
    expected: "rotate",
  },
  {
    label: "unpressed pointer move",
    button: -1,
    buttons: 0,
    shiftPressed: false,
    spacePressed: false,
    expected: "ignore",
  },
  {
    label: "Space without a pointer button",
    button: -1,
    buttons: 0,
    shiftPressed: false,
    spacePressed: true,
    expected: "ignore",
  },
  {
    label: "Shift + Space without a pointer button",
    button: -1,
    buttons: 0,
    shiftPressed: true,
    spacePressed: true,
    expected: "ignore",
  },
  {
    label: "unsupported auxiliary button",
    button: 3,
    buttons: 8,
    shiftPressed: false,
    spacePressed: false,
    expected: "ignore",
  },
  {
    label: "Shift + unsupported auxiliary button",
    button: 3,
    buttons: 8,
    shiftPressed: true,
    spacePressed: false,
    expected: "ignore",
  },
];

describe("image pointer intent", () => {
  const matrix = [true, false].flatMap((startsOnArtboard) =>
    pointerCases.map(({ label, ...pointer }) =>
      [
        `${label}, starting ${startsOnArtboard ? "on" : "outside"} the artboard`,
        { ...pointer, startsOnArtboard },
      ] as const,
    ),
  );

  it.each(matrix)("%s", (_label, { expected, ...input }) => {
    expect(getImagePointerIntent(input)).toBe(expected);
  });

  it.each([
    { shiftPressed: false, spacePressed: false },
    { shiftPressed: false, spacePressed: true },
    { shiftPressed: true, spacePressed: false },
    { shiftPressed: true, spacePressed: true },
  ])(
    "keeps the secondary drawing shortcut with Space=$spacePressed and Shift=$shiftPressed",
    ({ shiftPressed, spacePressed }) => {
      const pointer = { button: 2, buttons: 2, shiftPressed, spacePressed };
      expect(getImagePointerIntent({ ...pointer, startsOnArtboard: true })).toBe("paint");
      expect(getImagePointerIntent({ ...pointer, startsOnArtboard: false })).toBe("paint");
    },
  );
});
