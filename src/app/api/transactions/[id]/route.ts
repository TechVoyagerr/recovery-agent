import { db } from "@/lib/db";
import { api } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    const tx = await db.transaction.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        attempts: { orderBy: { attemptNo: "asc" } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });
    return Response.json(tx);
  });
}
