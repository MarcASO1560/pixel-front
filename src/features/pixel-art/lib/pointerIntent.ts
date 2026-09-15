export type ImagePointerIntent = "pan" | "paint" | "rotate" | "ignore";

export type ImagePointerIntentInput = Readonly<{
  button: number;
  buttons: number;
  shiftPressed: boolean;
  spacePressed: boolean;
  startsOnArtboard: boolean;
}>;

const PRIMARY_BUTTON_MASK = 1;
const SECONDARY_BUTTON_MASK = 2;
const MIDDLE_BUTTON_MASK = 4;

/**
 * Resolves the editor gesture independently from DOM event routing.
 *
 * A primary or secondary press represents painting, even when it starts outside
 * the artboard. The caller can therefore arm that pointer and begin applying
 * the corresponding color once it reaches a pixel. Panning remains an explicit
 * middle-button or Space + primary gesture. Holding Shift turns either panning
 * gesture into rotation, without changing the normal drawing shortcuts.
 */
export const getImagePointerIntent = ({
  button,
  buttons,
  shiftPressed,
  spacePressed,
}: ImagePointerIntentInput): ImagePointerIntent => {
  const hasMiddleButton = button === 1 || (buttons & MIDDLE_BUTTON_MASK) !== 0;
  if (hasMiddleButton) {
    return shiftPressed ? "rotate" : "pan";
  }

  const hasPrimaryButton = button === 0 || (buttons & PRIMARY_BUTTON_MASK) !== 0;
  if (hasPrimaryButton) {
    if (!spacePressed) {
      return "paint";
    }

    return shiftPressed ? "rotate" : "pan";
  }

  const hasSecondaryButton = button === 2 || (buttons & SECONDARY_BUTTON_MASK) !== 0;
  return hasSecondaryButton ? "paint" : "ignore";
};
