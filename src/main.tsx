import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import App from "./App";
import "./styles.css";
import { loadTelegramBridge } from "./lib/platform";
import { trackPageView } from "./lib/firebaseAnalytics";
import { loadPlayerConfig } from "./lib/playerConfig";

function AnalyticsPageViews() {
  const { pathname } = useLocation();
  useEffect(() => trackPageView(pathname), [pathname]);
  return null;
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
async function start() {
  root.render(<p role="status">Loading…</p>);
  try {
    await Promise.all([loadPlayerConfig(), loadTelegramBridge().catch(() => {})]);
  } catch {
    root.render(<main><p role="alert">Unable to load site settings. Please try again.</p><button className="btn btn-primary" onClick={() => void start()}>Retry</button></main>);
    return;
  }
  root.render(
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AnalyticsPageViews />
      <App />
    </BrowserRouter>,
  );
}
void start();
