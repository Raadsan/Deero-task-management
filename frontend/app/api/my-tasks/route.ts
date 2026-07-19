import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
const ALLOWED_SCOPES = new Set(["personal", "company", "all"]);

export async function GET(request: NextRequest) {
  const requestedScope = request.nextUrl.searchParams.get("scope") ?? "all";
  const scope = ALLOWED_SCOPES.has(requestedScope) ? requestedScope : "all";

  try {
    const response = await fetch(
      `${API_URL}/api/tasks/assigned/me?scope=${scope}`,
      {
        headers: {
          cookie: request.headers.get("cookie") ?? "",
        },
        cache: "no-store",
      },
    );

    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    console.error("Failed to load assigned tasks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to connect to the tasks service",
      },
      { status: 502 },
    );
  }
}
