import { hasDatabaseUrl, isDbReachable } from "./db.ts";

export default async function handler(_req: any, res: any) {
  if (!hasDatabaseUrl()) {
    res.status(200).json({ status: "ok", dbConfigured: false, dbConnected: false });
    return;
  }
  const dbConnected = await isDbReachable();
  res.status(200).json({ status: "ok", dbConfigured: true, dbConnected });
}
