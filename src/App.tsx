import { useMemo, useState } from "react";
import "./App.css";
import type { ActiveStream, PlayerLayout } from "./types";

const maxStreams = 6;

const layoutOptions: { id: PlayerLayout; label: string }[] = [
  { id: "grid_equal", label: "Auto" },
  { id: "fixed_2x2", label: "2x2" },
  { id: "fixed_3x3", label: "3x3" },
  { id: "main_sub", label: "Focus" },
  { id: "pip", label: "PiP" },
];

const layoutAliases: Record<string, PlayerLayout> = {
  auto: "grid_equal",
  grid: "grid_equal",
  grid_equal: "grid_equal",
  "2x2": "fixed_2x2",
  fixed_2x2: "fixed_2x2",
  "3x3": "fixed_3x3",
  fixed_3x3: "fixed_3x3",
  focus: "main_sub",
  main: "main_sub",
  main_sub: "main_sub",
  pip: "pip",
};

const chatSandbox =
  "allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals";

function normalizeChannel(raw: string): string | null {
  const trimmed = raw.trim().replace(/^@+/, "");
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const pathPart = url.pathname.split("/").filter(Boolean)[0];
    if (pathPart) candidate = pathPart;
  } catch {
    // Not a URL, keep the raw value.
  }

  const normalized = candidate.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,25}$/.test(normalized)) return null;
  return normalized;
}

function parseChannels(params: URLSearchParams): ActiveStream[] {
  const values = [
    ...params.getAll("channels"),
    ...params.getAll("channel"),
  ];
  const unique = new Set<string>();

  for (const value of values) {
    for (const part of value.split(",")) {
      const channel = normalizeChannel(part);
      if (channel) unique.add(channel);
      if (unique.size >= maxStreams) break;
    }
    if (unique.size >= maxStreams) break;
  }

  return Array.from(unique).map((channel) => ({ channel }));
}

function parseLayout(params: URLSearchParams): PlayerLayout {
  const raw = params.get("layout")?.trim().toLowerCase();
  return raw ? layoutAliases[raw] ?? "grid_equal" : "grid_equal";
}

function parseMuted(params: URLSearchParams): boolean {
  const raw = params.get("muted")?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}

export function getTwitchEmbedParents(): string[] {
  const host = window.location.hostname;
  const parents = new Set<string>();

  if (host) {
    parents.add(host);
  }

  if (host === "localhost" || host === "127.0.0.1" || !host) {
    parents.add("localhost");
  }

  return Array.from(parents);
}

export function buildTwitchParentQuery(): string {
  return getTwitchEmbedParents()
    .map((parent) => `parent=${encodeURIComponent(parent)}`)
    .join("&");
}

function getPlayerUrl(channel: string, muted: boolean) {
  const params = new URLSearchParams({
    channel,
    muted: String(muted),
    autoplay: "true",
  });
  const parentQuery = buildTwitchParentQuery();

  return `https://player.twitch.tv/?${params.toString()}&${parentQuery}`;
}

function getChatUrl(channel: string) {
  const parentQuery = buildTwitchParentQuery();
  return `https://www.twitch.tv/embed/${encodeURIComponent(
    channel,
  )}/chat?${parentQuery}`;
}

function App() {
  const initialParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const [activeStreams, setActiveStreams] = useState<ActiveStream[]>(() =>
    parseChannels(initialParams),
  );
  const [layout, setLayout] = useState<PlayerLayout>(() =>
    parseLayout(initialParams),
  );
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const muted = useMemo(() => parseMuted(initialParams), [initialParams]);

  const activeChannels = useMemo(
    () => activeStreams.map((stream) => stream.channel),
    [activeStreams],
  );
  const initialActive = normalizeChannel(initialParams.get("active") ?? "");
  const [chatChannel, setChatChannel] = useState(() =>
    initialActive && activeChannels.includes(initialActive)
      ? initialActive
      : activeChannels[0] ?? "",
  );
  const selectedChatChannel = activeChannels.includes(chatChannel)
    ? chatChannel
    : activeChannels[0] ?? "";

  function removeStream(channel: string) {
    setActiveStreams((current) => {
      const next = current.filter((stream) => stream.channel !== channel);
      if (chatChannel === channel) {
        setChatChannel(next[0]?.channel ?? "");
      }
      return next;
    });
  }

  return (
    <div className="app-shell" data-right-collapsed={isRightCollapsed}>
      <main className="workspace">
        <header className="toolbar">
          <div>
            <p className="eyebrow">
              Watching {activeStreams.length} / {maxStreams}
            </p>
            <h1>Twi-Twi Multi Viewer</h1>
          </div>

          <div className="toolbar-actions">
            <div className="layout-switcher" aria-label="Layout">
              {layoutOptions.map((option) => (
                <button
                  className="layout-button"
                  data-active={layout === option.id}
                  key={option.id}
                  type="button"
                  onClick={() => setLayout(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="muted-state">
              Initial audio: {muted ? "muted" : "unmuted"}
            </span>
          </div>
        </header>

        <section
          className={`player-area layout-${layout}`}
          data-count={activeStreams.length}
        >
          {activeStreams.length === 0 ? (
            <div className="empty-stage">
              <span>No channels</span>
              <p>Open with ?channels=channel_a,channel_b</p>
            </div>
          ) : (
            activeStreams.map((stream) => (
              <article className="player-slot" key={stream.channel}>
                <div className="player-header">
                  <button
                    className="player-title"
                    type="button"
                    onClick={() => setChatChannel(stream.channel)}
                    title={`Show ${stream.channel} chat`}
                  >
                    {stream.channel}
                  </button>
                  <a
                    className="open-link"
                    href={`https://www.twitch.tv/${stream.channel}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${stream.channel} on Twitch`}
                  >
                    Twitch
                  </a>
                  <button
                    className="close-button"
                    type="button"
                    onClick={() => removeStream(stream.channel)}
                    aria-label={`Close ${stream.channel}`}
                  >
                    x
                  </button>
                </div>
                <iframe
                  title={`${stream.channel} player`}
                  src={getPlayerUrl(stream.channel, muted)}
                  allowFullScreen
                  allow="autoplay; fullscreen"
                />
              </article>
            ))
          )}
        </section>
      </main>

      <aside className="sidebar sidebar-right" aria-label="Chat area">
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setIsRightCollapsed((current) => !current)}
          aria-label={isRightCollapsed ? "Open chat panel" : "Close chat panel"}
          aria-expanded={!isRightCollapsed}
        >
          {isRightCollapsed ? "<" : ">"}
        </button>

        <div className="sidebar-content chat-panel">
          <section className="chat-slot">
            <div className="chat-controls">
              <label htmlFor="chat-target">Chat</label>
              <select
                id="chat-target"
                value={selectedChatChannel}
                onChange={(event) => setChatChannel(event.target.value)}
                disabled={activeChannels.length === 0}
              >
                {activeChannels.length === 0 ? (
                  <option value="">No channels</option>
                ) : (
                  activeChannels.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))
                )}
              </select>
            </div>

            <p className="chat-note">
              If chat is unavailable, sign in to Twitch in this browser.
            </p>

            <div className="chat-frame">
              {selectedChatChannel ? (
                <iframe
                  title={`${selectedChatChannel} chat`}
                  src={getChatUrl(selectedChatChannel)}
                  sandbox={chatSandbox}
                />
              ) : (
                <div className="empty-chat">Chat waiting</div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default App;
