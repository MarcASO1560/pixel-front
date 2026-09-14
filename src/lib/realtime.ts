import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";

import { API_V1_URL } from "./api";

export const REALTIME_EVENT_NAMES = [
  "workspace.updated",
  "project.updated",
  "project.deleted",
  "project.access.updated",
  "project.share.updated",
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENT_NAMES)[number];
export type RealtimeEventPayload = Record<string, unknown> & {
  actor_id?: string;
  created_at?: string;
  event_id?: number;
  project_id?: string;
};
export type RealtimeEventHandlers = Partial<
  Record<RealtimeEventName, (payload: RealtimeEventPayload) => void>
>;

type RealtimeConfig = {
  enabled: boolean;
  supabase_url?: string | null;
  publishable_key?: string | null;
  access_token?: string | null;
  expires_at?: string | null;
  channel?: string | null;
  latest_event_id: number;
};

type EnabledRealtimeConfig = RealtimeConfig & {
  supabase_url: string;
  publishable_key: string;
  access_token: string;
  expires_at: string;
  channel: string;
};

type PersistedRealtimeEvent = {
  id: number;
  event: string;
  data: Record<string, unknown>;
  created_at: string;
};

export type RealtimeConnection = {
  close: () => void;
};

const INITIAL_SUBSCRIPTION_TIMEOUT_MS = 8000;
const TOKEN_REFRESH_MARGIN_MS = 60000;
const MAX_CATCH_UP_BATCHES = 20;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const fetchRealtimeConfig = async () => {
  const response = await fetch(`${API_V1_URL}/events/config`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Realtime configuration failed with ${response.status}`);
  }
  return (await response.json()) as RealtimeConfig;
};

const isSupabaseConfig = (
  config: RealtimeConfig,
): config is EnabledRealtimeConfig =>
  config.enabled &&
  Boolean(config.supabase_url) &&
  Boolean(config.publishable_key) &&
  Boolean(config.access_token) &&
  Boolean(config.expires_at) &&
  Boolean(config.channel);

const parseSsePayload = (event: Event): RealtimeEventPayload => {
  try {
    const payload = JSON.parse((event as MessageEvent<string>).data) as unknown;
    return isObject(payload) ? payload : {};
  } catch {
    return {};
  }
};

const connectSseFallback = (
  handlers: RealtimeEventHandlers,
  isClosed: () => boolean,
) => {
  if (isClosed() || typeof EventSource === "undefined") {
    return () => undefined;
  }

  const source = new EventSource(`${API_V1_URL}/events/stream`, {
    withCredentials: true,
  });
  for (const eventName of REALTIME_EVENT_NAMES) {
    const handler = handlers[eventName];
    if (handler) {
      source.addEventListener(eventName, (event) => handler(parseSsePayload(event)));
    }
  }

  return () => source.close();
};

const removeSupabaseConnection = (
  client: RealtimeClient,
  channel: RealtimeChannel,
) => {
  void client.removeChannel(channel).finally(() => client.disconnect());
};

export const connectUserRealtime = (
  handlers: RealtimeEventHandlers,
): RealtimeConnection => {
  let closed = false;
  let cleanup: () => void = () => undefined;

  const installCleanup = (nextCleanup: () => void) => {
    cleanup();
    if (closed) {
      nextCleanup();
      return;
    }
    cleanup = nextCleanup;
  };

  const useSseFallback = () => {
    installCleanup(connectSseFallback(handlers, () => closed));
  };

  void (async () => {
    try {
      const config = await fetchRealtimeConfig();
      if (closed) {
        return;
      }
      if (!isSupabaseConfig(config)) {
        useSseFallback();
        return;
      }
      let activeConfig: EnabledRealtimeConfig = config;

      let lastEventId = Math.max(0, activeConfig.latest_event_id || 0);
      const seenEventIds = new Set<number>();
      let catchUpPromise: Promise<void> | null = null;

      const dispatch = (eventName: string, rawPayload: unknown) => {
        if (closed || !REALTIME_EVENT_NAMES.includes(eventName as RealtimeEventName)) {
          return;
        }

        const payload = isObject(rawPayload) ? rawPayload : {};
        const eventId =
          typeof payload.event_id === "number" && Number.isSafeInteger(payload.event_id)
            ? payload.event_id
            : null;
        if (eventId !== null) {
          if (seenEventIds.has(eventId)) {
            return;
          }
          seenEventIds.add(eventId);
          lastEventId = Math.max(lastEventId, eventId);
          if (seenEventIds.size > 500) {
            const recentIds = [...seenEventIds].slice(-250);
            seenEventIds.clear();
            recentIds.forEach((id) => seenEventIds.add(id));
          }
        }

        handlers[eventName as RealtimeEventName]?.(payload);
      };

      const catchUp = () => {
        if (catchUpPromise || closed) {
          return catchUpPromise;
        }

        catchUpPromise = (async () => {
          try {
            for (let batch = 0; batch < MAX_CATCH_UP_BATCHES && !closed; batch += 1) {
              const response = await fetch(
                `${API_V1_URL}/events/pending?after_event_id=${encodeURIComponent(lastEventId)}`,
                {
                  credentials: "same-origin",
                  headers: { Accept: "application/json" },
                },
              );
              if (!response.ok) {
                return;
              }

              const events = (await response.json()) as PersistedRealtimeEvent[];
              if (!Array.isArray(events)) {
                return;
              }
              for (const event of events) {
                dispatch(event.event, {
                  ...(isObject(event.data) ? event.data : {}),
                  event_id: event.id,
                  created_at: event.created_at,
                });
              }
              if (events.length < 50) {
                return;
              }
            }
          } catch {
            // The normal periodic refresh remains the final recovery path.
          }
        })().finally(() => {
          catchUpPromise = null;
        });
        return catchUpPromise;
      };

      const getAccessToken = async () => {
        const expiresAt = Date.parse(activeConfig.expires_at);
        if (Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
          return activeConfig.access_token;
        }

        const refreshedConfig = await fetchRealtimeConfig();
        if (!isSupabaseConfig(refreshedConfig)) {
          return null;
        }
        activeConfig = refreshedConfig;
        return activeConfig.access_token;
      };

      const realtimeUrl = `${activeConfig.supabase_url.replace(/^http/i, "ws")}/realtime/v1`;
      const client = new RealtimeClient(realtimeUrl, {
        accessToken: getAccessToken,
        params: { apikey: activeConfig.publishable_key },
      });
      const channel = client.channel(activeConfig.channel, {
        config: { private: true },
      });
      for (const eventName of REALTIME_EVENT_NAMES) {
        if (handlers[eventName]) {
          channel.on("broadcast", { event: eventName }, ({ payload }) => {
            dispatch(eventName, payload);
          });
        }
      }

      installCleanup(() => removeSupabaseConnection(client, channel));

      const subscribed = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (result: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          resolve(result);
        };
        const timeoutId = window.setTimeout(
          () => finish(false),
          INITIAL_SUBSCRIPTION_TIMEOUT_MS,
        );

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            finish(true);
            void catchUp();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            finish(false);
          }
        });
      });

      if (!subscribed && !closed) {
        useSseFallback();
      }
    } catch (error) {
      if (!closed) {
        console.warn("Supabase Realtime unavailable; using SSE fallback.", error);
        useSseFallback();
      }
    }
  })();

  return {
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      cleanup();
      cleanup = () => undefined;
    },
  };
};
