import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  RealtimeClient: vi.fn(),
}));

vi.mock("@supabase/realtime-js", () => ({
  RealtimeClient: supabaseMocks.RealtimeClient,
}));

import { connectUserRealtime } from "./realtime";

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
