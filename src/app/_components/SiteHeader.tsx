import Link from "next/link";

/**
 * Top navigation: product wordmark on the left, "Log in" link on the right.
 * The login route is owned by F02 — F01 only links to it.
 */
export function SiteHeader() {
  return (
    <header className="w-full border-b border-border">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="rounded-sm text-lg font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          VideoMax MBA
        </Link>
        <Link
          href="/login"
          className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Log in
        </Link>
      </nav>
    </header>
  );
}
