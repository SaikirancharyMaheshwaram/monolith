import { jwtVerify } from "jose";

export async function requireAuth(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

    const { payload } = await jwtVerify(token, secret);

    return payload as {
      userId: string;
      walletAddress: string;
    };
  } catch {
    throw new Error("Unauthorized");
  }
}
