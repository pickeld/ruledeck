import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("id")?.value;
  const path = request.nextUrl.pathname;
  const publicPath =
    path === "/login" || path.startsWith("/join/") || path.startsWith("/api/v1/");
  if (!token && !publicPath) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  if (token && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
