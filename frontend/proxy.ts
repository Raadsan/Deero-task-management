import { NextResponse, type NextRequest } from "next/server";
import { getUserSession } from "./lib/actions/auth.action";
import { ROUTES } from "./lib/constants";
export async function proxy(request: NextRequest) {
  const authResult = await getUserSession();
  const session = authResult.data;
  const pathName = request.nextUrl.pathname;

  const publicRoutes = [ROUTES.login, ROUTES.register, ROUTES.verify];

  const isPublicRoute = publicRoutes.some(
    (route) => pathName === route || pathName.startsWith(`${route}`),
  );
  const role = session?.user.role;

  if (!session) {
    if (isPublicRoute) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  if (isPublicRoute) {
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
