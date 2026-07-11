import crypto from "node:crypto";
import fs from "node:fs";
import { serverConfig } from "./config.js";

export function createNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

export function readPrivateKey(): string {
  return fs.readFileSync(serverConfig.wechatPay.privateKeyPath, "utf8");
}

export function signWithMerchantPrivateKey(message: string): string {
  return crypto.createSign("RSA-SHA256").update(message, "utf8").sign(readPrivateKey(), "base64");
}

export function signWechatPayRequest(
  method: string,
  urlPathWithQuery: string,
  timestamp: string,
  nonce: string,
  body: string
): string {
  const message = `${method.toUpperCase()}\n${urlPathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`;
  return signWithMerchantPrivateKey(message);
}

export function buildAuthorizationHeader(params: {
  method: string;
  urlPathWithQuery: string;
  timestamp: string;
  nonce: string;
  body: string;
}): string {
  const signature = signWechatPayRequest(
    params.method,
    params.urlPathWithQuery,
    params.timestamp,
    params.nonce,
    params.body
  );

  const authorizationParams = [
    `mchid="${serverConfig.wechatPay.mchId}"`,
    `nonce_str="${params.nonce}"`,
    `signature="${signature}"`,
    `timestamp="${params.timestamp}"`,
    `serial_no="${serverConfig.wechatPay.certSerialNo}"`
  ].join(",");

  return `WECHATPAY2-SHA256-RSA2048 ${authorizationParams}`;
}

export function decryptWechatResource<T>(resource: {
  ciphertext: string;
  associated_data?: string;
  nonce: string;
}): T {
  const key = Buffer.from(serverConfig.wechatPay.apiV3Key, "utf8");
  if (key.length !== 32) {
    throw new Error("WECHAT_PAY_API_V3_KEY must be 32 bytes for AES-256-GCM.");
  }

  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encryptedData = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, resource.nonce);
  decipher.setAuthTag(authTag);

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function verifyWechatSignature(params: {
  timestamp: string;
  nonce: string;
  body: Buffer | string;
  signature: string;
  certificate: string;
}): boolean {
  const body = Buffer.isBuffer(params.body) ? params.body.toString("utf8") : params.body;
  const message = `${params.timestamp}\n${params.nonce}\n${body}\n`;

  return crypto.createVerify("RSA-SHA256").update(message, "utf8").verify(params.certificate, params.signature, "base64");
}
