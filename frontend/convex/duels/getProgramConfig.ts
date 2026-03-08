import { query } from "../_generated/server";
import bs58 from "bs58";

export const getProgramConfig = query({
  args: {},
  handler: async () => {
    const secret = process.env.BACKEND_SIGNER_SECRET_KEY;
    if (!secret) {
      throw new Error("Missing BACKEND_SIGNER_SECRET_KEY");
    }

    const secretKey = bs58.decode(secret);
    const backendPubkey = bs58.encode(secretKey.slice(32));

    return {
      backendPubkey,
      feeBps: 500,
    };
  },
});
