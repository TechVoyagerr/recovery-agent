import { ZodError } from "zod";
export function api(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((error) => {
    if (error instanceof ZodError)
      return Response.json(
        {
          error: "Invalid request",
          issues: error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    if (error?.code === "P2025")
      return Response.json({ error: "Not found" }, { status: 404 });
    console.error(
      "API request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return Response.json({ error: "Request failed" }, { status: 500 });
  });
}
export function demoGuard(request: Request): Response | null {
  if (process.env.NODE_ENV !== "production" || process.env.DEMO_PUBLIC === "true") return null;
  const token = process.env.DEMO_API_TOKEN;
  if (!token)
    return Response.json(
      {
        error:
          "Demo mutations disabled in production; configure DEMO_API_TOKEN",
      },
      { status: 403 },
    );
  if (request.headers.get("authorization") !== `Bearer ${token}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
