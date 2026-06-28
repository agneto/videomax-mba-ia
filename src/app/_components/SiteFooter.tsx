/**
 * Minimal footer: product name, a short tagline, and the current year.
 * The year is computed at render time (RSC), so it stays current without
 * client JavaScript.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted sm:flex-row">
        <span className="font-semibold text-foreground">VideoMax MBA</span>
        <span>Upload. Transcribe. Summarize.</span>
        <span>&copy; {year} VideoMax MBA</span>
      </div>
    </footer>
  );
}
