import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { loadTelegramBridge } from "./lib/platform";

void loadTelegramBridge().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>,
  );
});
