import { getSessionFromRequest } from "../adminAuth.ts";

export default async function handler(req: any, res: any) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(200).json({ session: null });
    return;
  }
  res.status(200).json({ session: { userId: session.userId, email: session.email } });
}
