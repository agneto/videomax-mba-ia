import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/app/_components/SiteHeader";
import { getSession } from "@/app/_lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/app");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Log in
        </h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Welcome back. Enter your credentials to continue.
        </p>
        <LoginForm />
        <p className="mt-6 text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-accent-hover hover:underline"
          >
            Create account
          </Link>
        </p>
      </main>
    </>
  );
}
