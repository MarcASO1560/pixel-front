export type ImagePointerIntent = "pan" | "paint" | "ignore";

export type ImagePointerIntentInput = Readonly<{
  button: number;
  buttons: number;
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
 * middle-button or Space + primary gesture.
 */
export const getImagePointerIntent = ({
  button,
  buttons,
  spacePressed,
}: ImagePointerIntentInput): ImagePointerIntent => {
  const hasMiddleButton = button === 1 || (buttons & MIDDLE_BUTTON_MASK) !== 0;
  if (hasMiddleButton) {
    return "pan";
  }

  const hasPrimaryButton = button === 0 || (buttons & PRIMARY_BUTTON_MASK) !== 0;
  if (hasPrimaryButton) {
    return spacePressed ? "pan" : "paint";
  }

  const hasSecondaryButton = button === 2 || (buttons & SECONDARY_BUTTON_MASK) !== 0;
  return hasSecondaryButton ? "paint" : "ignore";
};
