export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except auth routes, API auth, app pages (loaded in iframes), and static files
  matcher: [
    "/",
    "/api/chat/:path*",
    "/api/conversations/:path*",
    "/api/orchestrator/:path*",
    "/api/admin/:path*",
  ],
};
