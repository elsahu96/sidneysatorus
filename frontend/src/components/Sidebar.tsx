import {
  Home,
  Globe,
  FolderOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useAuth } from "@/hooks/useAuth";
import { useSignOut } from "@/hooks/useSignOut";

// ── Top-level nav items ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { title: "Home", icon: Home, path: "/", resetChat: true },
  { title: "Dark Web", icon: Globe, path: "/dark-web" },
  { title: "Case Files", icon: FolderOpen, path: "/case-files" },
  { title: "Chat History", icon: MessageSquare, path: "/sessions" },
];

/** User avatar: photo URL → colour circle with initials */
function UserAvatar({
  photoURL,
  displayName,
  email,
  size = "sm",
}: {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-8 w-8 text-sm" : "h-7 w-7 text-xs";
  const initials = (displayName ?? email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt="avatar"
        className={cn("rounded-full object-cover shrink-0", dim)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center shrink-0",
        dim,
      )}
    >
      {initials || "?"}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const { isCollapsed, setIsCollapsed } = useSidebarContext();
  const { user } = useAuth();
  const { handleSignOut } = useSignOut();
  const navigate = useNavigate();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* ── Logo / collapse toggle ───────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-3">
        {!isCollapsed && (
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Sidney<span className="text-primary">.</span>
          </h1>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "rounded-lg p-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all",
            isCollapsed && "mx-auto",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Top nav ─────────────────────────────────────────────── */}
      <nav className="shrink-0 space-y-0.5 px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              state={item.resetChat ? { resetChat: true } : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80",
                  isCollapsed && "justify-center",
                )
              }
              title={isCollapsed ? item.title : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && item.title}
            </NavLink>
          );
        })}
      </nav>

      {/* Spacer so profile section stays at the bottom */}
      <div className="flex-1" />

      {/* ── Bottom: profile / admin ──────────────────────────────── */}
      <div className="shrink-0 border-t border-border p-3">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-2",
            isCollapsed && "justify-center",
          )}
        >
          {/* Avatar — clicks to /admin */}
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            title="Admin / Profile"
          >
            <UserAvatar
              photoURL={user?.photoURL}
              displayName={user?.displayName}
              email={user?.email}
              size="sm"
            />
          </button>

          {!isCollapsed && (
            <>
              {/* Name / email — also links to admin */}
              <button
                type="button"
                onClick={() => navigate("/admin")}
                className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <span className="block truncate text-xs text-sidebar-foreground/80">
                  {user?.displayName ?? user?.email ?? "Profile"}
                </span>
              </button>

              {/* Sign out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
