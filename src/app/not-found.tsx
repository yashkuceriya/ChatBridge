import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-lg text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">
          404
        </p>
        <h1 className="mb-3 text-4xl font-bold text-zinc-100">
          Page not found
        </h1>
        <p className="mb-8 text-zinc-400">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          Back to ChatBridge
        </Link>
      </div>
    </div>
  );
}
