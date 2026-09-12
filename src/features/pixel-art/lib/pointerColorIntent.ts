import type { ImageTool, PixelColor } from "../types";

export type ImageColorChannel = "primary" | "secondary";

export type ImagePointerButtonInput = Readonly<{
  button: number;
  buttons: number;
}>;

export type ImageToolColorIntent =
  | Readonly<{ kind: "paint"; color: PixelColor }>
  | Readonly<{
      kind: "checker";
      inverted: boolean;
      primaryColor: string;
      secondaryColor: string;
    }>
  | Readonly<{ kind: "pick"; channel: ImageColorChannel }>
  | Readonly<{ kind: "none" }>;

type ImageToolColorIntentInput = Readonly<{
  tool: ImageTool;
  channel: ImageColorChannel;
  primaryColor: string;
  secondaryColor: string;
}>;

const PRIMARY_BUTTON_MASK = 1;
const SECONDARY_BUTTON_MASK = 2;

const COLOR_PAINT_TOOLS: ReadonlySet<ImageTool> = new Set([
  "pencil",
  "fill",
  "line",
  "rectangle",
  "ellipse",
]);

/**
 * Resolves which color channel initiated a drawing gesture.
 *
 * Pointer move events report `button: -1`, so the held-button bitmask is used
 * as a fallback. Ambiguous chords intentionally resolve to no channel; callers
 * should retain the channel captured on pointerdown for the rest of the gesture.
 */
export const getImagePointerColorChannel = ({
  button,
  buttons,
}: ImagePointerButtonInput): ImageColorChannel | null => {
  if (button === 0) return "primary";
  if (button === 2) return "secondary";

  const hasPrimaryButton = (buttons & PRIMARY_BUTTON_MASK) !== 0;
  const hasSecondaryButton = (buttons & SECONDARY_BUTTON_MASK) !== 0;
  if (hasPrimaryButton === hasSecondaryButton) return null;
  return hasSecondaryButton ? "secondary" : "primary";
};

/**
 * Maps an editor tool and pointer channel to its color-side effect.
 */
export const getImageToolColorIntent = ({
  tool,
  channel,
  primaryColor,
  secondaryColor,
}: ImageToolColorIntentInput): ImageToolColorIntent => {
  if (tool === "graffiti") {
    return {
      kind: "checker",
      inverted: channel === "secondary",
      primaryColor,
      secondaryColor,
    };
  }

  if (COLOR_PAINT_TOOLS.has(tool)) {
    return {
      kind: "paint",
      color: channel === "secondary" ? secondaryColor : primaryColor,
    };
  }

  if (tool === "erase") return { kind: "paint", color: null };
  if (tool === "picker") return { kind: "pick", channel };
  return { kind: "none" };
};
