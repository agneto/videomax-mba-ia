import Link from "next/link";

/**
 * Above-the-fold hero: product name, one-sentence value proposition, a short
 * supporting paragraph, and the primary "Create account" CTA (the only element
 * that carries the accent color). The register route is owned by F02.
 */
export function Hero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
        Turn your videos into searchable transcripts and summaries
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
        VideoMax MBA transcribes every video you upload and writes an AI summary,
        so you can read, search, and jump to any moment instead of rewatching.
      </p>
      <Link
        href="/register"
        className="mt-10 inline-flex items-center justify-center rounded-full bg-accent px-7 py-3.5 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Create account
      </Link>
    </section>
  );
}
