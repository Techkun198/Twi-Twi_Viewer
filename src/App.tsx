import { useState } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("lazvell, stylishnoob4");

  const channels = input
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div className="app">
      <header>
        <h1>Twi-Twi Web Multi Viewer (β)</h1>
        <div>
          <label>
            チャンネル（カンマ区切り）：
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="xqc, loltyler1, pokimane"
              style={{
                width: "300px",
                marginLeft: "10px",
              }}
            />
          </label>
        </div>
      </header>

      <main className="grid">
        {channels.length === 0 && <p>チャンネルを入力してください。</p>}

        {channels.map((channel) => (
          <div key={channel} className="cell">
            <div className="cell-header">{channel}</div>
            <iframe
              src={`https://player.twitch.tv/?channel=${channel}&parent=localhost&muted=true`}
              frameBorder="0"
              allowFullScreen
            ></iframe>
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
