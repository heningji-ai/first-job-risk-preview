import { assertWechatPayConfig } from "./config.js";
import { buildAuthorizationHeader, createNonce, decryptWechatResource, getTimestamp } from "./crypto.js";
import type { WechatNotifyResource } from "./types.js";

type WechatCertificateItem = {
  serial_no: string;
  effective_time: string;
  expire_time: string;
  encrypt_certificate: WechatNotifyResource;
};

type WechatCertificatesResponse = {
  data: WechatCertificateItem[];
};

type PlatformCertificate = {
  serialNo: string;
  certificate: string;
  expireTime: string;
};

let cachedCertificates: PlatformCertificate[] = [];
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchWechatPlatformCertificates(): Promise<PlatformCertificate[]> {
  assertWechatPayConfig();

  const method = "GET";
  const urlPathWithQuery = "/v3/certificates";
  const timestamp = getTimestamp();
  const nonce = createNonce();
  const body = "";
  const authorization = buildAuthorizationHeader({
    method,
    urlPathWithQuery,
    timestamp,
    nonce,
    body
  });

  const response = await fetch(`https://api.mch.weixin.qq.com${urlPathWithQuery}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Content-Type": "application/json",
      "User-Agent": "first-job-risk-preview-server"
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[wechat-platform-certs] Failed to fetch WeChat platform certificates: ${response.status} ${errorBody}`
    );
    throw new Error(`Failed to fetch WeChat platform certificates: ${response.status}`);
  }

  const data = (await response.json()) as WechatCertificatesResponse;

  return data.data.map((item) => ({
    serialNo: item.serial_no,
    certificate: decryptWechatResource<string>(item.encrypt_certificate),
    expireTime: item.expire_time
  }));
}

export async function refreshWechatPlatformCertificates(): Promise<PlatformCertificate[]> {
  cachedCertificates = await fetchWechatPlatformCertificates();
  cachedAt = Date.now();
  return cachedCertificates;
}

export async function getWechatPlatformCertificate(serialNo: string): Promise<string | null> {
  const isExpired = Date.now() - cachedAt > CACHE_TTL_MS;

  if (cachedCertificates.length === 0 || isExpired) {
    await refreshWechatPlatformCertificates();
  }

  let certificate = cachedCertificates.find((item) => item.serialNo === serialNo)?.certificate ?? null;
  if (!certificate) {
    await refreshWechatPlatformCertificates();
    certificate = cachedCertificates.find((item) => item.serialNo === serialNo)?.certificate ?? null;
  }

  return certificate;
}
