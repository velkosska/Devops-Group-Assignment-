import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBackend } from "./api";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/board.css";
import "./styles/drawer.css";
import "./styles/insights.css";
import "./styles/landing.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App backend={createBackend()} />
  </StrictMode>,
);
