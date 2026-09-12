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
    spacePressed: false,
    expected: "paint",
  },
  {
    label: "held primary move",
    button: -1,
    buttons: 1,
    spacePressed: false,
    expected: "paint",
  },
  {
    label: "Space + primary down",
    button: 0,
    buttons: 1,
    spacePressed: true,
    expected: "pan",
  },
  {
    label: "Space + held primary move",
    button: -1,
    buttons: 1,
    spacePressed: true,
    expected: "pan",
  },
  {
    label: "middle down reported by button",
    button: 1,
    buttons: 0,
    spacePressed: false,
    expected: "pan",
  },
  {
    label: "middle down reported by buttons",
    button: -1,
    buttons: 4,
    spacePressed: false,
    expected: "pan",
  },
  {
    label: "middle takes priority while primary is also held",
    button: 0,
    buttons: 5,
    spacePressed: false,
    expected: "pan",
  },
  {
    label: "unpressed pointer move",
    button: -1,
    buttons: 0,
    spacePressed: false,
    expected: "ignore",
  },
  {
    label: "Space without a pointer button",
    button: -1,
    buttons: 0,
    spacePressed: true,
    expected: "ignore",
  },
  {
    label: "unsupported auxiliary button",
    button: 3,
    buttons: 8,
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

  it.each([false, true])(
    "keeps the secondary drawing shortcut independent from Space when Space is %s",
    (spacePressed) => {
      const pointer = { button: 2, buttons: 2, spacePressed };
      expect(getImagePointerIntent({ ...pointer, startsOnArtboard: true })).toBe("paint");
      expect(getImagePointerIntent({ ...pointer, startsOnArtboard: false })).toBe("paint");
    },
  );
});
