"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setErrorMsg("Invalid email or password.");
      setLoading(false);
    } else {
      // Successful — redirect manually
      window.location.href = callbackUrl;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              ChatBridge
            </span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in to continue
          </p>
        </div>

        {/* Error message */}
        {(error || errorMsg) && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-center text-sm text-red-400">
            {errorMsg || (error === "CredentialsSignin"
              ? "Invalid email or password."
              : "Something went wrong. Please try again.")}
          </div>
        )}

        {/* Sign-in form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-zinc-400"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-zinc-400"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter any password"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1.5">
          <p className="text-[11px] font-medium text-zinc-400 text-center">Demo Accounts</p>
          <div className="space-y-1">
            {[
              { role: "Student", email: "student@chatbridge.edu", pw: "student123" },
              { role: "Teacher", email: "teacher@chatbridge.edu", pw: "teacher123" },
            ].map((a) => (
              <button
                key={a.role}
                type="button"
                onClick={() => { setEmail(a.email); setPassword(a.pw); }}
                className="flex items-center justify-between w-full rounded-md bg-zinc-800/50 px-2.5 py-1.5 text-left hover:bg-zinc-800 transition-colors"
              >
                <span className="text-[11px] text-zinc-400">
                  <span className="font-medium text-zinc-300">{a.role}</span> — {a.email}
                </span>
                <span className="text-[10px] text-zinc-600">{a.pw}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 text-center">Click to auto-fill</p>
        </div>
      </div>
    </div>
  );
}
