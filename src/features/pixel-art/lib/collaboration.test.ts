import { describe, expect, it } from "vitest";

import type { ProjectEditorActivity } from "../../../lib/realtime";
import { createPixelLayer } from "./document";
import { PIXEL_ART_PASTEL_PALETTE } from "./palette";
import {
  applyCollaborativePixelPatch,
  collaboratorColor,
  readCollaborativeCursor,
  readCollaborativeDocument,
  readCollaborativePixelPatch,
  readCollaborativeSelection,
} from "./collaboration";

const activity = (
  kind: ProjectEditorActivity["kind"],
  payload: Record<string, unknown>,
): ProjectEditorActivity => ({
  client_id: "client-2",
  kind,
  payload,
  resource_id: "resource-1",
  sent_at: "2026-09-14T14:00:00Z",
  sequence: 1,
  user: { id: "user-2", email: "artist@example.com", username: "Artist" },
});

describe("pixel-art collaboration", () => {
  it("accepts finite cursor positions across the workspace and rejects unsafe offsets", () => {
    expect(
      readCollaborativeCursor(
        activity("cursor", { height: 16, tool: "pencil", visible: true, width: 16, x: 3, y: 4 }),
      ),
    ).toEqual({ height: 16, tool: "pencil", visible: true, width: 16, x: 3, y: 4 });
    expect(
      readCollaborativeCursor(
        activity("cursor", {
          height: 16,
          tool: "pencil",
          visible: true,
          width: 16,
          x: -8.5,
          y: 20.25,
        }),
      ),
    ).toEqual({
      height: 16,
      tool: "pencil",
      visible: true,
      width: 16,
      x: -8.5,
      y: 20.25,
    });
    expect(
      readCollaborativeCursor(
        activity("cursor", {
          height: 16,
          tool: "pencil",
          visible: true,
          width: 16,
          x: 100001,
          y: 4,
        }),
      ),
    ).toBeNull();
  });

  it("applies only valid pixel patches to their target layer", () => {
    const layer = createPixelLayer(2, 2, { id: "layer-1" });
    const patch = readCollaborativePixelPatch(
      activity("pixels", {
        changes: [[1, "#ff0000"], [3, null]],
        height: 2,
        layer_id: "layer-1",
        width: 2,
      }),
    );
    expect(patch).not.toBeNull();
    expect(applyCollaborativePixelPatch([layer], patch!, 2, 2)?.[0]?.pixels).toEqual([
      null,
      "#ff0000",
      null,
      null,
    ]);
  });

  it("rejects malformed documents and accepts valid version 2 documents", () => {
    expect(readCollaborativeDocument(activity("document", { document: { version: 2 } }))).toBeNull();
    const layer = createPixelLayer(1, 1, { id: "layer-1" });
    expect(
      readCollaborativeDocument(
        activity("document", {
          document: { version: 2, width: 1, height: 1, palette: [], layers: [layer] },
        }),
      )?.layers[0]?.id,
    ).toBe("layer-1");
  });

  it("reads remote selection clearing and returns stable collaborator colors", () => {
    expect(readCollaborativeSelection(activity("selection", { selection: null }))).toBeNull();
    expect(
      readCollaborativeSelection(
        activity("selection", { selection: { height: 2, width: 3, x: 1, y: 4 } }),
      ),
    ).toEqual({ height: 2, width: 3, x: 1, y: 4 });
    expect(collaboratorColor("user-2")).toBe(collaboratorColor("user-2"));
    expect(PIXEL_ART_PASTEL_PALETTE).toHaveLength(16);
    expect(PIXEL_ART_PASTEL_PALETTE).toContain(collaboratorColor("user-2"));
  });
});
