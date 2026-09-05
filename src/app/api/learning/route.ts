import { getLearning } from "@/lib/queries";
import { api } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => Response.json(await getLearning()));
}
