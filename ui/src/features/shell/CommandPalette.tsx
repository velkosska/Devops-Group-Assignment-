import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CompanyAvatar } from "../../components/CompanyAvatar";
import { Dialog } from "../../components/Dialog";
import { Icon, type IconName } from "../../components/Icon";
import { Kbd } from "../../components/Kbd";
import { StageBadge } from "../../components/StageBadge";
import { matchesQuery } from "../../lib/follow-up";
import type { Application } from "../../lib/types";
import { useApplications } from "../../state/applications";

export interface PaletteAction {
  id: string;
  label: string;
  icon: IconName;
  hint?: string;
  run: () => void;
}

type Item = { kind: "action"; action: PaletteAction } | { kind: "app"; app: Application };

interface Props {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
  onOpenApplication: (id: number) => void;
}

export function CommandPalette({ open, onClose, actions, onOpenApplication }: Props) {
  const { applications } = useApplications();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const titleId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const acts = actions
      .filter((a) => !q || a.label.toLowerCase().includes(q))
      .map((action) => ({ kind: "action" as const, action }));
    const apps = q
      ? applications
          .filter((a) => matchesQuery(a, q))
          .slice(0, 8)
          .map((app) => ({ kind: "app" as const, app }))
      : [...applications]
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
          .slice(0, 5)
          .map((app) => ({ kind: "app" as const, app }));
    return q ? [...apps, ...acts] : [...acts, ...apps];
  }, [actions, applications, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    setTimeout(
      () => (item.kind === "action" ? item.action.run() : onOpenApplication(item.app.id)),
      0,
    );
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(items[active]);
    }
  };

  const firstApp = items.findIndex((i) => i.kind === "app");
  const firstAction = items.findIndex((i) => i.kind === "action");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="dialog--palette"
      initialFocus={inputRef}
    >
      <h2 id={titleId} className="visually-hidden">
        Search and commands
      </h2>
      <div className="palette">
        <div className="palette__input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search applications or type a command"
            placeholder="Search applications or type a command"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul ref={listRef} id={listId} role="listbox" className="palette__list" aria-label="Results">
          {items.length === 0 && (
            <li className="palette__empty" role="presentation">
              No results for “{query}”
            </li>
          )}
          {items.map((item, index) => (
            <li
              key={item.kind === "app" ? `app-${item.app.id}` : item.action.id}
              role="presentation"
            >
              {index === firstApp && (
                <p className="palette__group" aria-hidden="true">
                  {query ? "Applications" : "Recent"}
                </p>
              )}
              {index === firstAction && (
                <p className="palette__group" aria-hidden="true">
                  Actions
                </p>
              )}
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                data-index={index}
                className="palette__item"
                onMouseMove={() => setActive(index)}
                onClick={() => run(item)}
              >
                {item.kind === "action" ? (
                  <>
                    <span className="palette__icon">
                      <Icon name={item.action.icon} size={16} />
                    </span>
                    <span className="palette__label">{item.action.label}</span>
                    {item.action.hint && <Kbd>{item.action.hint}</Kbd>}
                  </>
                ) : (
                  <>
                    <CompanyAvatar company={item.app.company} size={26} />
                    <span className="palette__label">
                      {item.app.role} <span className="palette__muted">· {item.app.company}</span>
                    </span>
                    <StageBadge stage={item.app.stage} />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        <footer className="palette__footer" aria-hidden="true">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span>
            <Kbd>↵</Kbd> to open
          </span>
        </footer>
      </div>
    </Dialog>
  );
}
