import { proxyAssignedTasks } from "@/lib/apis/myTasksApi";
import { NextRequest, NextResponse } from "next/server";


const ALLOWED_SCOPES = new Set(["personal", "company", "all"]);

export async function GET(request: NextRequest) {
  const requestedScope = request.nextUrl.searchParams.get("scope") ?? "all";
  const scope = ALLOWED_SCOPES.has(requestedScope) ? requestedScope : "all";

  try {
    const { body, status } = await proxyAssignedTasks(
      scope as "personal" | "company" | "all",
      request.headers.get("cookie") ?? "",
    );
    return NextResponse.json(body, { status });
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
