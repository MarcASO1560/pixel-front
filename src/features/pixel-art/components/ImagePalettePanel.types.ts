export type ImagePalettePanelSwatch = {
  id: string | null;
  color: string;
  name: string | null;
  pinned: boolean;
  used: boolean;
};

export type ImagePalettePinRequest = {
  color: string;
  name?: string;
};

export type ImagePaletteEditRequest = {
  id?: string;
  originalColor: string;
  color: string;
  name?: string;
  pinned: boolean;
  used: boolean;
};

export type ImagePaletteRemoveRequest = {
  id: string;
  color: string;
  used: boolean;
};
