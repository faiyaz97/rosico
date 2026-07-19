"use client";

import {
  ChevronDown,
  CircleUserRound,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Users
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";

import { logoutAction } from "@/app/actions/auth";
import { Avatar, type AvatarPerson } from "@/components/ui";

type GroupOption = { id: string; name: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Menu({
  label,
  className,
  trigger,
  children
}: {
  label: string;
  className: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      const root = rootRef.current;
      if (
        open &&
        root &&
        event.target instanceof Node &&
        !root.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [open]);

  function close() {
    setOpen(false);
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const root = rootRef.current;
    if (!root || !open) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1 + items.length) % items.length
            : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div
      className={`app-menu ${className}`}
      ref={rootRef}
      data-open={open}
      onKeyDown={handleKeys}
    >
      <button
        className="menu-summary"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
      >
        {trigger}
      </button>
      {open && (
        <div className="menu-popover" role="menu" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function GroupSwitcher({
  groups,
  selectedGroup,
  canManage,
  compact = false
}: {
  groups: GroupOption[];
  selectedGroup?: GroupOption;
  canManage: boolean;
  compact?: boolean;
}) {
  return (
    <Menu
      label="Switch active group"
      className={`group-menu-wrapper ${compact ? "compact" : ""}`}
      trigger={
        <span className={`group-switcher ${compact ? "compact" : ""}`}>
          {!compact && (
            <span className="group-mini">
              {initials(selectedGroup?.name ?? "Rosica")}
            </span>
          )}
          <span className="group-switcher-copy">
            {!compact && <small>Current group</small>}
            <b>{selectedGroup?.name ?? "Choose a group"}</b>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      }
    >
      {(close) => (
        <>
          {groups.map((group) => (
            <Link
              href={`/app/groups/${group.id}`}
              aria-current={group.id === selectedGroup?.id ? "page" : undefined}
              role="menuitem"
              onClick={close}
              key={group.id}
            >
              <span className="group-mini">{initials(group.name)}</span>
              <span>{group.name}</span>
            </Link>
          ))}
          <div className="menu-separator" role="separator" />
          {canManage ? (
            <>
              <Link href="/app/groups/new" role="menuitem" onClick={close}>
                <Plus size={17} aria-hidden="true" /> Create group
              </Link>
              <Link href="/app/groups" role="menuitem" onClick={close}>
                <Users size={17} aria-hidden="true" /> Manage groups
              </Link>
            </>
          ) : (
            <Link href="/login" role="menuitem" onClick={close}>
              <LogIn size={17} aria-hidden="true" /> Sign in to manage groups
            </Link>
          )}
        </>
      )}
    </Menu>
  );
}

export function AccountMenu({
  account,
  currentPath,
  expanded = false
}: {
  account?: AvatarPerson;
  currentPath: string;
  expanded?: boolean;
}) {
  if (!account) {
    return (
      <Link
        className={`account-trigger ${expanded ? "expanded" : ""}`}
        href={`/login?next=${encodeURIComponent(currentPath)}`}
        aria-label="Sign in"
      >
        <CircleUserRound size={24} aria-hidden="true" />
        {expanded && <span>Sign in</span>}
      </Link>
    );
  }

  return (
    <Menu
      label="Open account menu"
      className={`account-menu-wrapper ${expanded ? "expanded" : ""}`}
      trigger={
        <span className={`account-trigger ${expanded ? "expanded" : ""}`}>
          <Avatar player={account} size="sm" />
          {expanded && (
            <span>
              <b>{account.name}</b>
              <small>Account menu</small>
            </span>
          )}
        </span>
      }
    >
      {(close) => (
        <>
          <div className="menu-label">{account.name}</div>
          <Link href="/app/settings" role="menuitem" onClick={close}>
            <Settings size={17} aria-hidden="true" /> Account settings
          </Link>
          <div className="menu-separator" role="separator" />
          <form action={logoutAction}>
            <button type="submit" role="menuitem">
              <LogOut size={17} aria-hidden="true" /> Log out
            </button>
          </form>
        </>
      )}
    </Menu>
  );
}
