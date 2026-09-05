import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const lastId = request.headers.get("last-event-id");
  const last = lastId
    ? await db.agentEvent.findUnique({ where: { id: lastId } })
    : null;
  let cursor = last
    ? { createdAt: last.createdAt, id: last.id }
    : { createdAt: new Date(), id: "" };
  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => {
        if (!closed) controller.enqueue(encoder.encode(s));
      };
      send("retry: 2000\n: connected\n\n");
      const stop = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        controller.close();
      };
      request.signal.addEventListener("abort", stop, { once: true });
      async function poll() {
        if (closed) return;
        try {
          const rows = await db.agentEvent.findMany({
            where: {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 200,
          });
          for (const row of rows) {
            send(`id: ${row.id}\ndata: ${JSON.stringify(row)}\n\n`);
            cursor = { createdAt: row.createdAt, id: row.id };
          }
          if (!rows.length) send(": heartbeat\n\n");
        } catch {
          send(
            'event: warning\ndata: {"message":"Stream temporarily unavailable"}\n\n',
          );
        }
        if (!closed) timer = setTimeout(poll, 1000);
      }
      void poll();
    },
    cancel() {
      closed = true;
      clearTimeout(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
