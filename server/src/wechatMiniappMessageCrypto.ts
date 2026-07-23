import crypto from "node:crypto";

export function safeConstantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWechatUrlSignature(input: { token: string; timestamp: string; nonce: string; signature: string }): boolean {
  const digest = crypto.createHash("sha1").update([input.token, input.timestamp, input.nonce].sort().join(""), "utf8").digest("hex");
  return safeConstantTimeEqual(digest, input.signature);
}

export function verifyWechatMessageSignature(input: { token: string; timestamp: string; nonce: string; encrypt: string; signature: string }): boolean {
  const digest = crypto.createHash("sha1").update([input.token, input.timestamp, input.nonce, input.encrypt].sort().join(""), "utf8").digest("hex");
  return safeConstantTimeEqual(digest, input.signature);
}

export function decryptWechatMiniappMessage(input: { encodingAesKey: string; appId: string; encrypted: string }): string {
  const key = Buffer.from(`${input.encodingAesKey}=`, "base64");
  if (key.length !== 32) throw new Error("INVALID_MESSAGE_KEY");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(Buffer.from(input.encrypted, "base64")), decipher.final()]);
  if (padded.length === 0) throw new Error("INVALID_MESSAGE_PADDING");
  const padding = padded[padded.length - 1];
  if (padding < 1 || padding > 32 || padding > padded.length) throw new Error("INVALID_MESSAGE_PADDING");
  for (let i = 1; i <= padding; i += 1) if (padded[padded.length - i] !== padding) throw new Error("INVALID_MESSAGE_PADDING");
  const plain = padded.subarray(0, padded.length - padding);
  if (plain.length < 20) throw new Error("INVALID_MESSAGE_PAYLOAD");
  const messageLength = plain.readUInt32BE(16);
  if (messageLength < 0 || messageLength > plain.length - 20) throw new Error("INVALID_MESSAGE_PAYLOAD");
  const message = plain.subarray(20, 20 + messageLength).toString("utf8");
  const payloadAppId = plain.subarray(20 + messageLength).toString("utf8");
  if (!safeConstantTimeEqual(payloadAppId, input.appId)) throw new Error("MESSAGE_APP_ID_MISMATCH");
  return message;
}
