import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";
import App from "./App";
import "./styles.css";
import { loadTelegramBridge } from "./lib/platform";
import { trackPageView } from "./lib/firebaseAnalytics";

function AnalyticsPageViews() {
  const { pathname } = useLocation();
  useEffect(() => trackPageView(pathname), [pathname]);
  return null;
}

void loadTelegramBridge().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AnalyticsPageViews />
      <App />
    </BrowserRouter>,
  );
});
