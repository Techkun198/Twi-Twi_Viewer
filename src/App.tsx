import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { ActiveStream, PlayerLayout } from "./types";
import {
  CANONICAL_REDIRECT_ENABLED,
  CANONICAL_VIEWER_HOST,
  CLOUDFLARE_PAGES_HOST,
  shouldRedirectToCanonical,
} from "./viewerConfig";

const maxStreams = 6;

type DebugPlayerEntry = {
  channel: string;
  displayName: string;
  playerSrc: string;
};

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

function normalizeDisplayName(raw: unknown, fallback: string): string {
  const normalized = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, 80);
}

function parseDisplayNames(params: URLSearchParams): string[] {
  const raw = params.get("displayNames") ?? params.get("names");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value ?? ""));
    }
  } catch {
    // Fall back to comma-separated names for manually crafted URLs.
  }

  return raw.split(",");
}

function parseChannels(params: URLSearchParams): ActiveStream[] {
  const values = [
    ...params.getAll("channels"),
    ...params.getAll("channel"),
  ];
  const unique = new Set<string>();
  const displayNames = parseDisplayNames(params);
  const streams: ActiveStream[] = [];

  for (const value of values) {
    for (const part of value.split(",")) {
      const channel = normalizeChannel(part);
      if (channel && !unique.has(channel)) {
        unique.add(channel);
        streams.push({
          channel,
          displayName: normalizeDisplayName(displayNames[streams.length], channel),
        });
      }
      if (unique.size >= maxStreams) break;
    }
    if (unique.size >= maxStreams) break;
  }

  return streams;
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

function parseDebug(params: URLSearchParams): boolean {
  const raw = params.get("debug")?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
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

async function writeClipboardText(value: string): Promise<void> {
  if (window.navigator.clipboard?.writeText) {
    await window.navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function DebugPanel({
  parentValues,
  playerEntries,
  selectedChatDisplayName,
  selectedChatSrc,
}: {
  parentValues: string[];
  playerEntries: DebugPlayerEntry[];
  selectedChatDisplayName: string;
  selectedChatSrc: string;
}) {
  const canonicalRedirect = CANONICAL_REDIRECT_ENABLED
    ? `enabled (${CLOUDFLARE_PAGES_HOST} -> ${CANONICAL_VIEWER_HOST})`
    : "disabled";

  return (
    <section className="debug-panel" aria-label="Twitch embed diagnostics">
      <h2>Debug</h2>
      <dl className="debug-grid">
        <dt>current host</dt>
        <dd>{window.location.hostname || "(empty)"}</dd>

        <dt>origin</dt>
        <dd>{window.location.origin}</dd>

        <dt>href</dt>
        <dd>
          <code className="debug-src">{window.location.href}</code>
        </dd>

        <dt>parent values</dt>
        <dd>{parentValues.join(", ") || "(none)"}</dd>

        <dt>canonical redirect</dt>
        <dd>
          {canonicalRedirect}; active now:{" "}
          {shouldRedirectToCanonical(window.location.hostname) ? "yes" : "no"}
        </dd>

        <dt>user agent</dt>
        <dd>
          <code className="debug-src">{window.navigator.userAgent}</code>
        </dd>

        <dt>player iframe src</dt>
        <dd>
          {playerEntries.length > 0 ? (
            <ul className="debug-src-list">
              {playerEntries.map((entry) => (
                <li key={entry.channel}>
                  <strong>{entry.displayName}</strong>
                  <code className="debug-src">{entry.playerSrc}</code>
                </li>
              ))}
            </ul>
          ) : (
            "(none)"
          )}
        </dd>

        <dt>chat iframe src</dt>
        <dd>
          {selectedChatSrc ? (
            <>
              <strong>{selectedChatDisplayName}</strong>
              <code className="debug-src">{selectedChatSrc}</code>
            </>
          ) : (
            "(none)"
          )}
        </dd>
      </dl>
    </section>
  );
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
  const isDebugMode = useMemo(() => parseDebug(initialParams), [initialParams]);
  const parentValues = useMemo(() => getTwitchEmbedParents(), []);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  const activeChannels = useMemo(
    () => activeStreams.map((stream) => stream.channel),
    [activeStreams],
  );
  const streamLabelMap = useMemo(
    () =>
      new Map(
        activeStreams.map((stream) => [stream.channel, stream.displayName]),
      ),
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
  const selectedChatDisplayName = selectedChatChannel
    ? streamLabelMap.get(selectedChatChannel) ?? selectedChatChannel
    : "";
  const playerDebugEntries = useMemo<DebugPlayerEntry[]>(
    () =>
      activeStreams.map((stream) => ({
        channel: stream.channel,
        displayName: stream.displayName,
        playerSrc: getPlayerUrl(stream.channel, muted),
      })),
    [activeStreams, muted],
  );
  const selectedChatSrc = selectedChatChannel
    ? getChatUrl(selectedChatChannel)
    : "";

  useEffect(() => {
    console.info("[Twi-Twi MultiViewer] Twitch embed diagnostics", {
      href: window.location.href,
      hostname: window.location.hostname,
      origin: window.location.origin,
      parentValues,
      playerIframeSrc: playerDebugEntries.map((entry) => ({
        channel: entry.channel,
        displayName: entry.displayName,
        src: entry.playerSrc,
      })),
      chatIframeSrc: selectedChatSrc
        ? {
            channel: selectedChatChannel,
            displayName: selectedChatDisplayName,
            src: selectedChatSrc,
          }
        : null,
      canonicalRedirect: {
        enabled: CANONICAL_REDIRECT_ENABLED,
        sourceHost: CLOUDFLARE_PAGES_HOST,
        targetHost: CANONICAL_VIEWER_HOST,
        activeNow: shouldRedirectToCanonical(window.location.hostname),
      },
      userAgent: window.navigator.userAgent,
    });
  }, [
    parentValues,
    playerDebugEntries,
    selectedChatChannel,
    selectedChatDisplayName,
    selectedChatSrc,
  ]);

  async function copyPlayerSrc(channel: string, playerSrc: string) {
    try {
      await writeClipboardText(playerSrc);
      setCopiedChannel(channel);
      window.setTimeout(() => {
        setCopiedChannel((current) => (current === channel ? null : current));
      }, 1600);
    } catch (error) {
      console.warn("[Twi-Twi MultiViewer] Failed to copy iframe src", error);
    }
  }

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
        <div className="top-stack">
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

          {isDebugMode && (
            <DebugPanel
              parentValues={parentValues}
              playerEntries={playerDebugEntries}
              selectedChatDisplayName={selectedChatDisplayName}
              selectedChatSrc={selectedChatSrc}
            />
          )}
        </div>

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
            playerDebugEntries.map((entry) => (
              <article className="player-slot" key={entry.channel}>
                <div
                  className="player-header"
                  data-debug={isDebugMode ? "true" : "false"}
                >
                  <button
                    className="player-title"
                    type="button"
                    onClick={() => setChatChannel(entry.channel)}
                    title={`Show ${entry.displayName} chat`}
                  >
                    {entry.displayName}
                  </button>
                  <a
                    className="open-link"
                    href={`https://www.twitch.tv/${entry.channel}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${entry.displayName} on Twitch`}
                  >
                    Twitch
                  </a>
                  {isDebugMode && (
                    <button
                      className="debug-copy-button"
                      type="button"
                      onClick={() =>
                        void copyPlayerSrc(entry.channel, entry.playerSrc)
                      }
                      title={`Copy ${entry.displayName} player iframe src`}
                    >
                      {copiedChannel === entry.channel ? "Copied" : "Copy src"}
                    </button>
                  )}
                  <button
                    className="close-button"
                    type="button"
                    onClick={() => removeStream(entry.channel)}
                    aria-label={`Close ${entry.displayName}`}
                  >
                    x
                  </button>
                </div>
                <iframe
                  title={`${entry.channel} player`}
                  src={entry.playerSrc}
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
                      {streamLabelMap.get(channel) ?? channel}
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
