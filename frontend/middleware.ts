import { NextResponse, type NextRequest } from "next/server";
import { getUserSession } from "./lib/actions/auth.action";
import {
  BRANCH_SLUG_COOKIE,
  LOGIN_BRANCH_ID_COOKIE,
  ROUTES,
} from "./lib/constants";
import { getBranchSlugFromPath } from "./lib/branch-branding";
import { canSuperadminUseAnyLogin } from "./lib/branch-login";

const MAIN_LOGIN_PATH = "/main-login";

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("session"));
}

function withBranchCookie(response: NextResponse, slug: string) {
  response.cookies.set(BRANCH_SLUG_COOKIE, slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

function clearBranchCookie(response: NextResponse) {
  response.cookies.delete(BRANCH_SLUG_COOKIE);
  return response;
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.includes("session") || cookie.name.startsWith("better-auth")) {
      response.cookies.delete(cookie.name);
    }
  }
  response.cookies.delete(LOGIN_BRANCH_ID_COOKIE);
  response.cookies.delete(BRANCH_SLUG_COOKIE);
  return response;
}

function rewriteMainLogin(request: NextRequest) {
  const response = NextResponse.rewrite(new URL(MAIN_LOGIN_PATH, request.url));
  return clearBranchCookie(response);
}

export async function middleware(request: NextRequest) {
  const pathName = request.nextUrl.pathname;

  if (pathName === "/auth/login" || pathName === "/enterprise") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathName === MAIN_LOGIN_PATH) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const authPages = [ROUTES.register, ROUTES.verify, ROUTES.forgotPassword];
  const isAuthPage = authPages.some(
    (route) => pathName === route || pathName.startsWith(`${route}`),
  );

  const pathBranchSlug = getBranchSlugFromPath(pathName);
  const cookieBranchSlug = request.cookies.get(BRANCH_SLUG_COOKIE)?.value ?? null;
  const branchSlug = pathBranchSlug || cookieBranchSlug;

  if (!hasSessionCookie(request)) {
    if (pathName === "/") {
      return rewriteMainLogin(request);
    }

    if (pathBranchSlug) {
      return withBranchCookie(NextResponse.next(), pathBranchSlug);
    }

    if (isAuthPage) {
      return NextResponse.next();
    }

    if (branchSlug) {
      return NextResponse.redirect(new URL(`/${branchSlug}`, request.url));
    }

    if (pathName !== "/") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return rewriteMainLogin(request);
  }

  const authResult = await getUserSession();
  const session = authResult.data;

  if (!session && pathName === "/") {
    return rewriteMainLogin(request);
  }

  if (pathBranchSlug && session) {
    if (session.user.role === "user") {
      return NextResponse.redirect(new URL(ROUTES["my-tasks"], request.url));
    }
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  if (pathBranchSlug && !session) {
    return withBranchCookie(NextResponse.next(), pathBranchSlug);
  }

  const role = session?.user.role;
  const userBranchId = session?.user.branchId as string | null | undefined;
  const loginBranchId = request.cookies.get(LOGIN_BRANCH_ID_COOKIE)?.value;

  if (
    session &&
    userBranchId &&
    loginBranchId &&
    loginBranchId !== userBranchId &&
    !canSuperadminUseAnyLogin(session.user)
  ) {
    const response = NextResponse.redirect(new URL("/", request.url));
    return clearAuthCookies(response, request);
  }

  if (!session) {
    if (isAuthPage) {
      return NextResponse.next();
    }

    if (branchSlug) {
      return NextResponse.redirect(new URL(`/${branchSlug}`, request.url));
    }

    if (pathName !== "/") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return rewriteMainLogin(request);
  }

  if (isAuthPage) {
    if (role === "user") {
      return NextResponse.redirect(new URL(ROUTES["my-tasks"], request.url));
    }
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  if (role === "user") {
    if (pathName.includes(ROUTES["my-tasks"])) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(ROUTES["my-tasks"], request.url));
  } else if (role === "admin") {
    return NextResponse.next();
  } else if (pathName.includes(ROUTES["my-tasks"])) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
