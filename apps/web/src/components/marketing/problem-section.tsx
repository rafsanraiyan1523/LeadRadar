export function ProblemSection() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium text-primary">The problem</p>
        <p className="mt-3 text-balance font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          &ldquo;Finding businesses is easy. Finding the <em className="text-foreground not-italic underline decoration-primary/40 decoration-2 underline-offset-4">right</em> businesses is not.&rdquo;
        </p>
        <p className="mt-5 text-balance text-muted-foreground">
          Directories and maps show you every business in a city. They don&apos;t show you which
          ones have a broken website, no online presence, or a Google listing nobody has claimed —
          the ones actually looking for what you sell.
        </p>
      </div>
    </section>
  );
}
