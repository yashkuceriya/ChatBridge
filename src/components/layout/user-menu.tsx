"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800" />
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const email = session.user.email ?? "user";
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-medium text-white">
          {initial}
        </div>
        {/* Email */}
        <span className="truncate text-sm text-zinc-400">{email}</span>
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        title="Sign out"
        className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
