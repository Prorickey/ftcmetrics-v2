import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  // Redirect if already logged in
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">FTC Metrics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in to start scouting
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
          <LoginForm />
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
