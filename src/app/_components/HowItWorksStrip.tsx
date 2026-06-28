/**
 * "How it works" strip: the three-step pipeline (upload → transcribe →
 * summarize) rendered as an ordered list so the sequence is conveyed
 * semantically, not just visually.
 */
const STEPS = [
  {
    title: "Upload",
    caption: "Drag and drop a video into your private library.",
  },
  {
    title: "Transcribe",
    caption: "We generate a timestamped, clickable transcription.",
  },
  {
    title: "Summarize",
    caption: "Read an AI overview and key topics before you watch.",
  },
] as const;

export function HowItWorksStrip() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="border-t border-border bg-surface"
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2
          id="how-it-works-heading"
          className="text-center text-sm font-semibold uppercase tracking-wider text-muted"
        >
          How it works
        </h2>
        <ol className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col items-center text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-base font-semibold text-accent-hover">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
                {step.caption}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
