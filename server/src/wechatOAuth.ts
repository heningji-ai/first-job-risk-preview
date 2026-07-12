import { nanoid } from "nanoid";
import { serverConfig } from "./config.js";
import { db } from "./db.js";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OPENID_TOKEN_TTL_MS = 30 * 60 * 1000;

type WechatOauthTokenResponse = {
  openid?: string;
  errcode?: number;
  errmsg?: string;
};

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function normalizeOauthReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  try {
    const parsed = new URL(trimmed, "https://local.invalid");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function createWechatOauthState(returnTo: string): string {
  const now = Date.now();
  const state = nanoid(32);

  db.prepare(
    `
      INSERT INTO wechat_oauth_states (
        state,
        returnTo,
        createdAt,
        expiresAt,
        usedAt
      ) VALUES (
        @state,
        @returnTo,
        @createdAt,
        @expiresAt,
        NULL
      )
    `
  ).run({
    state,
    returnTo,
    createdAt: toIso(now),
    expiresAt: toIso(now + OAUTH_STATE_TTL_MS)
  });

  return state;
}

export function buildWechatOauthUrl(state: string): string {
  if (!serverConfig.wechatPay.jsapiAppId || !serverConfig.wechatPay.jsapiOauthCallbackUrl) {
    throw new Error("WeChat JSAPI OAuth is not configured.");
  }

  const params = new URLSearchParams({
    appid: serverConfig.wechatPay.jsapiAppId,
    redirect_uri: serverConfig.wechatPay.jsapiOauthCallbackUrl,
    response_type: "code",
    scope: "snsapi_base",
    state
  });

  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
}

function consumeWechatOauthState(state: string): string {
  const row = db
    .prepare(
      `
        SELECT state, returnTo, expiresAt, usedAt
        FROM wechat_oauth_states
        WHERE state = ?
      `
    )
    .get(state) as { returnTo: string; expiresAt: string; usedAt: string | null } | undefined;

  if (!row || row.usedAt || Date.parse(row.expiresAt) <= Date.now()) {
    throw new Error("WeChat OAuth state is invalid or expired.");
  }

  db.prepare("UPDATE wechat_oauth_states SET usedAt = @usedAt WHERE state = @state").run({
    state,
    usedAt: new Date().toISOString()
  });

  return row.returnTo;
}

function appendOpenidToken(returnTo: string, token: string): string {
  const parsed = new URL(returnTo, "https://local.invalid");
  parsed.searchParams.set("wechatOpenidToken", token);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export async function exchangeWechatOauthCodeForOpenid(code: string): Promise<string> {
  if (!serverConfig.wechatPay.jsapiAppId || !serverConfig.wechatPay.jsapiAppSecret) {
    throw new Error("WeChat JSAPI OAuth is not configured.");
  }

  const params = new URLSearchParams({
    appid: serverConfig.wechatPay.jsapiAppId,
    secret: serverConfig.wechatPay.jsapiAppSecret,
    code,
    grant_type: "authorization_code"
  });
  const response = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${params.toString()}`);
  const data = (await response.json()) as WechatOauthTokenResponse;

  if (!response.ok || !data.openid) {
    throw new Error(`WeChat OAuth openid exchange failed: ${data.errcode ?? response.status}`);
  }

  return data.openid;
}

export function createWechatOpenidToken(openid: string): string {
  const now = Date.now();
  const token = nanoid(32);

  db.prepare(
    `
      INSERT INTO wechat_openid_tokens (
        token,
        openid,
        createdAt,
        expiresAt
      ) VALUES (
        @token,
        @openid,
        @createdAt,
        @expiresAt
      )
    `
  ).run({
    token,
    openid,
    createdAt: toIso(now),
    expiresAt: toIso(now + OPENID_TOKEN_TTL_MS)
  });

  return token;
}

export function consumeWechatOpenidToken(token: string): string {
  const row = db
    .prepare(
      `
        SELECT openid, expiresAt
        FROM wechat_openid_tokens
        WHERE token = ?
      `
    )
    .get(token) as { openid: string; expiresAt: string } | undefined;

  if (!row || Date.parse(row.expiresAt) <= Date.now()) {
    throw new Error("WeChat openid token is invalid or expired.");
  }

  return row.openid;
}

export async function handleWechatOauthCallback(code: string, state: string): Promise<string> {
  const returnTo = consumeWechatOauthState(state);
  const openid = await exchangeWechatOauthCodeForOpenid(code);
  const token = createWechatOpenidToken(openid);
  return appendOpenidToken(returnTo, token);
}
