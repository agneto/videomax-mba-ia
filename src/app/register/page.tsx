import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { getSession } from "@/app/_lib/session";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) {
    redirect("/app");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Start transcribing and summarizing your videos in minutes.
        </p>
        <RegisterForm />
        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-accent-hover hover:underline"
          >
            Log in
          </Link>
        </p>
      </main>
    </>
  );
}
