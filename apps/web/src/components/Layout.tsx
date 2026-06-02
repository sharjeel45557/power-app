import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, LogOut, Plug, Table2 } from "lucide-react";
import type { SourceMeta } from "@power-app/core/meta";
import { api, pathPrefix } from "../lib/api";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

export function Layout() {
  const { user, logout } = useAuth();
  const [sources, setSources] = useState<SourceMeta[]>([]);

  useEffect(() => {
    api
      .sources()
      .then((res) => setSources(res.sources))
      .catch(() => setSources([]));
  }, []);

  const entities = sources.filter((s) => s.kind === "entity");
  const connectors = sources.filter((s) => s.kind === "connector");

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const sectionLabel = "px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            P
          </div>
          <span className="text-base font-semibold tracking-tight">power-app</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavLink to="/" end className={navClass}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>

          <p className={sectionLabel}>Apps</p>
          {entities.map((s) => (
            <NavLink key={s.name} to={`/e/${s.name}`} className={navClass}>
              <Table2 className="h-4 w-4" />
              {s.label}
            </NavLink>
          ))}

          {connectors.length > 0 && (
            <>
              <p className={sectionLabel}>Connected data</p>
              {connectors.map((s) => (
                <NavLink
                  key={s.name}
                  to={`${pathPrefix("connectors")}/${s.name}`}
                  className={navClass}
                  title={s.source}
                >
                  <Plug className="h-4 w-4" />
                  {s.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="md:hidden font-semibold">power-app</div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.roles.join(", ")}</p>
            </div>
            <button
              onClick={() => void logout()}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
