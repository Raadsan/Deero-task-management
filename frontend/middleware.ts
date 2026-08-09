import { NextResponse, type NextRequest } from "next/server";
import { getBranchSlugFromPath } from "./lib/portfolio-branding";

const LOGIN_PATH = "/auth/login";
const AUTH_ROUTES = {
  login: LOGIN_PATH,
  verify: "/auth/verify",
  forgotPassword: "/auth/forgot-password",
  dashboard: "/",
} as const;

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("session"));
}

function forwardWithPathname(request: NextRequest, pathName: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathName);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export async function middleware(request: NextRequest) {
  const pathName = request.nextUrl.pathname;

  if (pathName === "/notification" || pathName === "/notification/") {
    return NextResponse.redirect(new URL("/notifications", request.url));
  }

  if (
    pathName === "/enterprise" ||
    pathName === "/main-login" ||
    pathName === "/auth/register" ||
    pathName.startsWith("/auth/register/")
  ) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const pathBranchSlug = getBranchSlugFromPath(pathName);
  if (pathBranchSlug) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const authPages = [
    AUTH_ROUTES.login,
    AUTH_ROUTES.verify,
    AUTH_ROUTES.forgotPassword,
  ];
  const isAuthPage = authPages.some(
    (route) => pathName === route || pathName.startsWith(`${route}`),
  );

  // A cookie can outlive its server-side session. Always let the login page
  // load so an expired cookie cannot cause a dashboard/login redirect loop.
  if (isAuthPage) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return forwardWithPathname(request, pathName);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};

