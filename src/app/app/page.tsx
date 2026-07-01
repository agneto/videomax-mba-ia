import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/_components/LogoutButton";
import { UploadDropZone } from "@/app/_components/upload/UploadDropZone";
import { UploadProgressList } from "@/app/_components/upload/UploadProgressList";
import { getSession } from "@/app/_lib/session";

/**
 * Authenticated library shell.
 *
 * F02 redirects here after login/registration; F03 makes it functional by
 * mounting the upload drop zone and progress list. The video grid/list itself
 * is F04's job — for now the shell shows the upload surface and a placeholder.
 */
export default async function LibraryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your library
          </h1>
          <p className="mt-1 text-sm text-muted">
            Upload a video to transcribe and summarize it.
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="mt-8">
        <UploadDropZone />
      </section>

      <section className="mt-6">
        <UploadProgressList />
      </section>

      <section className="mt-10">
        <p className="text-sm text-muted">
          Your uploaded videos will appear here once processing begins.
        </p>
      </section>
    </main>
  );
}
