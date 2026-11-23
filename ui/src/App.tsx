import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Backend } from "./api";
import { resetDemo } from "./api/demo";
import { Button } from "./components/Button";
import { Toaster } from "./components/Toaster";
import { ApplicationDrawer } from "./features/application/ApplicationDrawer";
import { NewApplicationDialog } from "./features/application/NewApplicationDialog";
import { BoardPage } from "./features/board/BoardPage";
import { InsightsPage } from "./features/insights/InsightsPage";
import { LandingPage } from "./features/landing/LandingPage";
import { AppShell } from "./features/shell/AppShell";
import { CommandPalette, type PaletteAction } from "./features/shell/CommandPalette";
import type { Stage } from "./lib/stages";
import { ApplicationsProvider, useApplications } from "./state/applications";
import { BackendProvider } from "./state/backend";
import { RouterProvider, useRouter } from "./state/router";
import { ToastProvider } from "./state/toasts";
import { useTheme } from "./state/theme";

export function App({ backend }: { backend: Backend }) {
  return (
    <BackendProvider backend={backend}>
      <RouterProvider>
        <ToastProvider>
          <ApplicationsProvider>
            <Workspace />
            <Toaster />
          </ApplicationsProvider>
        </ToastProvider>
      </RouterProvider>
    </BackendProvider>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function Workspace() {
  const { page, navigate, openApplication } = useRouter();
  const { status } = useApplications();
  const [theme, setTheme] = useTheme();
  const [newStage, setNewStage] = useState<Stage | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const startNew = useCallback(
    (stage: Stage = "applied") => {
      if (status !== "error") setNewStage(stage);
    },
    [status],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        page !== "landing" &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (page === "landing") return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        startNew();
      } else if (event.key === "/" && page === "board") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, startNew]);

  const firstRender = useRef(true);
  useEffect(() => {
    document.title =
      page === "landing"
        ? "Shortlist · Track every job application"
        : `${page === "board" ? "Board" : "Insights"} · Shortlist`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [page]);

  const actions = useMemo<PaletteAction[]>(
    () => [
      { id: "new", label: "New application", icon: "plus", hint: "N", run: () => startNew() },
      { id: "board", label: "Go to Board", icon: "board", run: () => navigate("/board") },
      { id: "insights", label: "Go to Insights", icon: "chart", run: () => navigate("/insights") },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? "sun" : "moon",
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
    ],
    [navigate, setTheme, startNew, theme],
  );

  const onResetDemo = () => {
    if (
      window.confirm("Reset the demo? Your demo changes will be replaced with the sample data.")
    ) {
      resetDemo();
      window.location.assign("/board");
    }
  };

  if (page === "landing") return <LandingPage theme={theme} onTheme={setTheme} />;

  return (
    <>
      <AppShell
        theme={theme}
        onTheme={setTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onResetDemo={onResetDemo}
      >
        <div key={page} className="page-enter">
          {page === "board" ? (
            <BoardPage onAdd={startNew} searchRef={searchRef} />
          ) : (
            <InsightsPage />
          )}
        </div>
      </AppShell>

      {page === "board" && status !== "error" && (
        <Button
          variant="primary"
          icon="plus"
          className="fab"
          onClick={() => startNew()}
          aria-label="New application"
        >
          New
        </Button>
      )}

      <NewApplicationDialog
        open={newStage !== null}
        stage={newStage ?? "applied"}
        onClose={() => setNewStage(null)}
      />
      <ApplicationDrawer />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={actions}
        onOpenApplication={(id) => openApplication(id)}
      />
    </>
  );
}
