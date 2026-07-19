"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";

import { AccountMenu, GroupSwitcher } from "@/components/app-menus";
import { Logo } from "@/components/logo";
import type { AvatarPerson } from "@/components/ui";
import {
  groupPrimaryNavigation,
  recordResultNavigation,
  type GroupNavigationItem
} from "@/lib/group-navigation";

type GroupOption = { id: string; name: string; description?: string | null };

function PrimaryLink({
  item,
  base,
  pathname,
  compact = false
}: {
  item: GroupNavigationItem;
  base: string;
  pathname: string;
  compact?: boolean;
}) {
  const active = item.isActive(pathname, base);
  const Icon = item.icon;
  return (
    <Link
      href={item.href(base)}
      className={`nav-link ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
      {!compact && <span>{item.label}</span>}
    </Link>
  );
}

export function AppShell({
  children,
  groups = [],
  account,
  selectedGroup,
  canManageGroup = true,
  canManageGroups = true
}: {
  children: ReactNode;
  groups?: GroupOption[];
  account?: AvatarPerson;
  selectedGroup?: GroupOption;
  canManageGroup?: boolean;
  canManageGroups?: boolean;
}) {
  const pathname = usePathname();
  const routeGroup = groups.find((group) =>
    pathname.includes(`/groups/${group.id}`)
  );
  const selected = routeGroup ?? selectedGroup ?? groups[0];
  const base = selected ? `/app/groups/${selected.id}` : "/app/groups";
  const hasGroup = Boolean(selected);

  useEffect(() => {
    if (!selected || !account || !canManageGroup) return;
    document.cookie = `rosica_last_group=${encodeURIComponent(selected.id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [account, canManageGroup, selected]);

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <Logo compact href={hasGroup ? base : "/app"} />
        <GroupSwitcher
          groups={groups}
          selectedGroup={selected}
          canManage={canManageGroups}
          compact
        />
        <AccountMenu account={account} currentPath={pathname} />
      </header>

      <aside className="desktop-sidebar">
        <Logo href={hasGroup ? base : "/app"} />
        <GroupSwitcher
          groups={groups}
          selectedGroup={selected}
          canManage={canManageGroups}
        />
        {hasGroup && canManageGroup && (
          <Link
            className="sidebar-record-action"
            href={recordResultNavigation.href(base)}
          >
            <recordResultNavigation.icon size={19} aria-hidden="true" />
            {recordResultNavigation.label}
          </Link>
        )}
        {selected && (
          <nav aria-label="Primary navigation">
            {groupPrimaryNavigation.map((item) => (
              <PrimaryLink
                key={item.id}
                item={item}
                base={base}
                pathname={pathname}
              />
            ))}
          </nav>
        )}
        <div className="sidebar-account">
          <AccountMenu account={account} currentPath={pathname} expanded />
        </div>
      </aside>

      <main className="app-main">
        {selected && (
          <header className="mobile-group-context">
            <div>
              <p className="eyebrow">Group</p>
              {pathname === base ? (
                <h1>{selected.name}</h1>
              ) : (
                <strong>{selected.name}</strong>
              )}
              {selected.description && <small>{selected.description}</small>}
            </div>
            {canManageGroup && (
              <Link
                className="icon-link"
                href={`${base}/settings`}
                aria-label={`Settings for ${selected.name}`}
              >
                <Settings size={19} aria-hidden="true" />
              </Link>
            )}
          </header>
        )}
        {children}
      </main>

      {hasGroup && (
        <nav className="mobile-bottom-nav" aria-label="Primary navigation">
          {groupPrimaryNavigation.slice(0, 2).map((item) => (
            <PrimaryLink
              key={item.id}
              item={item}
              base={base}
              pathname={pathname}
            />
          ))}
          {canManageGroup ? (
            <Link
              className="nav-link primary"
              href={recordResultNavigation.href(base)}
              aria-label={recordResultNavigation.label}
            >
              <recordResultNavigation.icon size={22} aria-hidden="true" />
              <span>{recordResultNavigation.mobileLabel}</span>
            </Link>
          ) : (
            <span className="nav-action-placeholder" aria-hidden="true" />
          )}
          {groupPrimaryNavigation.slice(2).map((item) => (
            <PrimaryLink
              key={item.id}
              item={item}
              base={base}
              pathname={pathname}
            />
          ))}
        </nav>
      )}
    </div>
  );
}
