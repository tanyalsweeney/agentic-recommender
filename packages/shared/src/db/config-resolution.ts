import { eq, and } from "drizzle-orm";
import { config } from "./schema.js";

type Db = Parameters<typeof getConfig>[0];

export async function getConfig(
  db: { select: () => any },
  key: string,
  tenantId?: string
): Promise<string | null> {
  const dbTyped = db as any;

  if (tenantId) {
    const [override] = await dbTyped
      .select()
      .from(config)
      .where(and(eq(config.key, key), eq(config.owner, tenantId)))
      .limit(1);
    if (override) return override.value;
  }

  const [global] = await dbTyped
    .select()
    .from(config)
    .where(and(eq(config.key, key), eq(config.owner, "global")))
    .limit(1);

  return global?.value ?? null;
}
