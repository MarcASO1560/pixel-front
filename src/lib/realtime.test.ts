import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  RealtimeClient: vi.fn(),
}));

vi.mock("@supabase/realtime-js", () => ({
  RealtimeClient: supabaseMocks.RealtimeClient,
}));

import {
  connectProjectPresence,
  connectUserRealtime,
  groupProjectPresenceState,
} from "./realtime";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("connectUserRealtime", () => {
  it("uses SSE as a safe fallback when Supabase is not configured", async () => {
    const listeners = new Map<string, (event: Event) => void>();
    const close = vi.fn();
    let eventSourceUrl = "";
    let eventSourceOptions: EventSourceInit | undefined;

    class FakeEventSource {
      constructor(url: string | URL, options?: EventSourceInit) {
        eventSourceUrl = String(url);
        eventSourceOptions = options;
      }

      addEventListener(name: string, handler: EventListener) {
        listeners.set(name, handler);
      }

      close = close;
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ enabled: false, latest_event_id: 7 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("EventSource", FakeEventSource);
    const onProjectUpdated = vi.fn();

    const connection = connectUserRealtime({
      "project.updated": onProjectUpdated,
    });
    await vi.waitFor(() => expect(eventSourceUrl).toBe("/api/v1/events/stream"));

    listeners.get("project.updated")?.({
      data: JSON.stringify({ project_id: "project-1" }),
    } as MessageEvent<string>);

    expect(eventSourceOptions).toEqual({ withCredentials: true });
    expect(onProjectUpdated).toHaveBeenCalledWith({ project_id: "project-1" });

    connection.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("subscribes to a private channel and catches up persisted events", async () => {
    const broadcastHandlers = new Map<
      string,
      (message: { payload: Record<string, unknown> }) => void
    >();
    let subscriptionHandler: ((status: string) => void) | undefined;
    const channel = {
      on: vi.fn(
        (
          _type: string,
          filter: { event: string },
          handler: (message: { payload: Record<string, unknown> }) => void,
        ) => {
          broadcastHandlers.set(filter.event, handler);
          return channel;
        },
      ),
      subscribe: vi.fn((handler: (status: string) => void) => {
        subscriptionHandler = handler;
        handler("SUBSCRIBED");
        return channel;
      }),
    };
    const disconnect = vi.fn();
    const removeChannel = vi.fn(async () => "ok");
    supabaseMocks.RealtimeClient.mockImplementation(
      class {
        channel = vi.fn(() => channel);
        disconnect = disconnect;
        removeChannel = removeChannel;
      } as unknown as (...args: any[]) => any,
    );
    vi.stubGlobal("window", {
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/events/config")) {
          return new Response(
            JSON.stringify({
              enabled: true,
              supabase_url: "https://project.supabase.co",
              publishable_key: "sb_publishable_test",
              access_token: "realtime-token",
              expires_at: "2099-09-14T12:00:00Z",
              channel: "user:user-1",
              latest_event_id: 10,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/events/pending?after_event_id=10")) {
          return new Response(
            JSON.stringify([
              {
                id: 11,
                event: "project.updated",
                data: { project_id: "project-1" },
                created_at: "2026-09-14T12:00:00Z",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const onProjectUpdated = vi.fn();

    const connection = connectUserRealtime({
      "project.updated": onProjectUpdated,
    });

    await vi.waitFor(() => {
      expect(subscriptionHandler).toBeTypeOf("function");
      expect(onProjectUpdated).toHaveBeenCalledWith({
        project_id: "project-1",
        event_id: 11,
        created_at: "2026-09-14T12:00:00Z",
      });
    });

    expect(supabaseMocks.RealtimeClient).toHaveBeenCalledWith(
      "wss://project.supabase.co/realtime/v1",
      expect.objectContaining({
        accessToken: expect.any(Function),
        params: { apikey: "sb_publishable_test" },
      }),
    );
    expect(channel.on).toHaveBeenCalledWith(
      "broadcast",
      { event: "project.updated" },
      expect.any(Function),
    );

    broadcastHandlers.get("project.updated")?.({
      payload: { project_id: "project-1", event_id: 11 },
    });
    expect(onProjectUpdated).toHaveBeenCalledOnce();

    broadcastHandlers.get("project.updated")?.({
      payload: { project_id: "project-1", event_id: 12 },
    });
    expect(onProjectUpdated).toHaveBeenCalledTimes(2);

    connection.close();
    expect(removeChannel).toHaveBeenCalledWith(channel);
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
  });
});

describe("project presence", () => {
  it("groups presence by resource and deduplicates multiple tabs for one user", () => {
    expect(
      groupProjectPresenceState({
        "user-1": [
          {
            id: "user-1",
            email: "one@example.com",
            username: "One",
            resource_id: "resource-1",
            online_at: "2026-09-14T12:00:00Z",
          },
          {
            id: "user-1",
            email: "one@example.com",
            username: "One",
            resource_id: "resource-1",
            online_at: "2026-09-14T12:01:00Z",
          },
        ],
        "user-2": [
          {
            id: "user-2",
            email: "two@example.com",
            username: "Two",
            resource_id: "resource-2",
          },
        ],
        invalid: [{ id: "invalid", email: "invalid@example.com" }],
      }),
    ).toEqual({
      "resource-1": [
        expect.objectContaining({
          id: "user-1",
          resource_id: "resource-1",
          online_at: "2026-09-14T12:01:00Z",
        }),
      ],
      "resource-2": [
        expect.objectContaining({ id: "user-2", resource_id: "resource-2" }),
      ],
    });
  });

  it("tracks the open resource and publishes synchronized project presence", async () => {
    let presenceSync: (() => void) | undefined;
    const track = vi.fn(async () => "ok");
    const untrack = vi.fn(async () => "ok");
    const state = {
      "user-1": [
        {
          id: "user-1",
          email: "artist@example.com",
          username: "Artist",
          resource_id: "resource-1",
        },
      ],
    };
    const channel = {
      on: vi.fn(
        (
          type: string,
          filter: { event: string },
          handler: () => void,
        ) => {
          if (type === "presence" && filter.event === "sync") presenceSync = handler;
          return channel;
        },
      ),
      presenceState: vi.fn(() => state),
      subscribe: vi.fn((handler: (status: string) => void) => {
        handler("SUBSCRIBED");
        return channel;
      }),
      track,
      untrack,
    };
    const disconnect = vi.fn();
    const removeChannel = vi.fn(async () => "ok");
    const createChannel = vi.fn(() => channel);
    supabaseMocks.RealtimeClient.mockImplementation(
      class {
        channel = createChannel;
        disconnect = disconnect;
        removeChannel = removeChannel;
      } as unknown as (...args: any[]) => any,
    );
    vi.stubGlobal("window", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            enabled: true,
            supabase_url: "https://project.supabase.co",
            publishable_key: "sb_publishable_test",
            access_token: "realtime-token",
            expires_at: "2099-09-14T12:00:00Z",
            channel: "project:project-1:presence",
            user: {
              id: "user-1",
              email: "artist@example.com",
              username: "Artist",
              avatar_url: null,
              avatar_pixel_art: null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const onSync = vi.fn();

    const connection = connectProjectPresence("project-1", onSync, "resource-1");

    await vi.waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "user-1",
          resource_id: "resource-1",
        }),
      );
    });
    expect(createChannel).toHaveBeenCalledWith("project:project-1:presence", {
      config: {
        private: true,
        presence: { enabled: true, key: "user-1" },
      },
    });

    presenceSync?.();
    expect(onSync).toHaveBeenLastCalledWith({
      "resource-1": [
        expect.objectContaining({ id: "user-1", resource_id: "resource-1" }),
      ],
    });

    connection.setResourceId(null);
    await vi.waitFor(() => expect(untrack).toHaveBeenCalled());
    connection.close();
    await vi.waitFor(() => expect(removeChannel).toHaveBeenCalledWith(channel));
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
