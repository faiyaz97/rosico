import { Gamepad2, Home, Plus, Swords, Users } from "lucide-react";

export type GroupNavigationItem = {
  id: "overview" | "players" | "competitions" | "games";
  label: string;
  icon: typeof Home;
  href: (base: string) => string;
  isActive: (pathname: string, base: string) => boolean;
};

export const groupPrimaryNavigation: readonly GroupNavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Home,
    href: (base) => base,
    isActive: (pathname, base) => pathname === base
  },
  {
    id: "players",
    label: "Players",
    icon: Users,
    href: (base) => `${base}/players`,
    isActive: (pathname, base) => pathname.startsWith(`${base}/players`)
  },
  {
    id: "competitions",
    label: "Competitions",
    icon: Swords,
    href: (base) => `${base}/competitions`,
    isActive: (pathname, base) =>
      pathname.startsWith(`${base}/competitions`) ||
      pathname.startsWith(`${base}/tournaments`)
  },
  {
    id: "games",
    label: "Games",
    icon: Gamepad2,
    href: (base) => `${base}/games`,
    isActive: (pathname, base) =>
      pathname.startsWith(`${base}/games`) &&
      !pathname.startsWith(`${base}/games/new`)
  }
] as const;

export const recordResultNavigation = {
  label: "Record result",
  mobileLabel: "Record",
  icon: Plus,
  href: (base: string) => `${base}/games/new`
} as const;
