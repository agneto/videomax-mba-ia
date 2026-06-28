import { redirect } from "next/navigation";
import { Hero } from "@/app/_components/Hero";
import { HowItWorksStrip } from "@/app/_components/HowItWorksStrip";
import { SiteFooter } from "@/app/_components/SiteFooter";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { getSession } from "@/app/_lib/session";

/**
 * Public landing page (RSC, no client JS).
 *
 * Authenticated visitors are redirected server-side to `/app` before any
 * markup renders, which avoids a flash of the marketing page. The session
 * check goes through the F01 stub today; F02 will make it real without
 * touching this file. `redirect()` throws, so it must run before returning JSX.
 */
export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/app");
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorksStrip />
      </main>
      <SiteFooter />
    </>
  );
}
