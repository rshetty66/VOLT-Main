import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Overlays } from "./components/Overlays";
import { guardedFetch } from "./netGuard";
import "./styles.css";

window.fetch = guardedFetch(window.fetch.bind(window));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Overlays />
  </StrictMode>,
);
