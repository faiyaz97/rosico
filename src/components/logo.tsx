import Link from "next/link";

export function RosicaMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 42 42"
      role="img"
      aria-label="Rosica"
    >
      <rect width="42" height="42" rx="12" fill="currentColor" />
      <path
        d="M11 30V12h11.5c5.1 0 8.5 3 8.5 7.3 0 3.1-1.9 5.7-5 6.8L31.5 30h-7.1l-4.7-3.5h-2.4V30H11Zm6.3-9.1h4.4c1.9 0 3-1.1 3-2.5 0-1.5-1.1-2.4-3-2.4h-4.4v4.9Z"
        fill="white"
      />
      <circle cx="31.5" cy="10.5" r="4.5" fill="#F2B632" />
    </svg>
  );
}

export function Logo({
  compact = false,
  href = "/"
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="logo-link" aria-label="Rosica home">
      <RosicaMark className="logo-mark" />
      {!compact && <span className="logo-word">rosica</span>}
    </Link>
  );
}
