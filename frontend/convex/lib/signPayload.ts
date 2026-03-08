import nacl from "tweetnacl";
import bs58 from "bs58";
import { Buffer } from "buffer";

export function signHash(hashHex: string) {
  const secret = process.env.BACKEND_SIGNER_SECRET_KEY!;
  console.log({ secret });

  const secretKey = bs58.decode(secret);
  console.log(secretKey.length); // should print 64


  const messageBytes = Buffer.from(hashHex, "hex");

  const signature = nacl.sign.detached(messageBytes, secretKey);

  return bs58.encode(signature);
}
