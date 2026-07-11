import path from "node:path";

export type PaymentModeConfig = "mock" | "native";

function getEnv(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

function getDefaultPaymentMode(nodeEnv: string): PaymentModeConfig {
  return nodeEnv === "production" ? "native" : "mock";
}

const nodeEnv = getEnv("NODE_ENV", "development");
const wechatPayPublicKeyPath = getEnv("WECHAT_PAY_PUBLIC_KEY_PATH");

export const serverConfig = {
  port: Number(getEnv("PORT", "3001")),
  nodeEnv,
  frontendOrigin: getEnv("FRONTEND_ORIGIN", "http://127.0.0.1:5173"),
  paymentMode: getEnv("PAYMENT_MODE", getDefaultPaymentMode(nodeEnv)) as PaymentModeConfig,
  wechatPay: {
    mchId: getEnv("WECHAT_PAY_MCH_ID"),
    appId: getEnv("WECHAT_PAY_APP_ID"),
    certSerialNo: getEnv("WECHAT_PAY_CERT_SERIAL_NO"),
    apiV3Key: getEnv("WECHAT_PAY_API_V3_KEY"),
    privateKeyPath: path.resolve(process.cwd(), getEnv("WECHAT_PAY_PRIVATE_KEY_PATH", "./certs/apiclient_key.pem")),
    publicKeyId: getEnv("WECHAT_PAY_PUBLIC_KEY_ID"),
    publicKeyPath: wechatPayPublicKeyPath ? path.resolve(process.cwd(), wechatPayPublicKeyPath) : "",
    notifyUrl: getEnv("WECHAT_PAY_NOTIFY_URL"),
    description: getEnv("WECHAT_PAY_DESCRIPTION", "第一份工作风险预演完整报告")
  }
};

export function assertWechatPayConfig(): void {
  const missing = Object.entries({
    WECHAT_PAY_MCH_ID: serverConfig.wechatPay.mchId,
    WECHAT_PAY_APP_ID: serverConfig.wechatPay.appId,
    WECHAT_PAY_CERT_SERIAL_NO: serverConfig.wechatPay.certSerialNo,
    WECHAT_PAY_API_V3_KEY: serverConfig.wechatPay.apiV3Key,
    WECHAT_PAY_PRIVATE_KEY_PATH: serverConfig.wechatPay.privateKeyPath,
    WECHAT_PAY_NOTIFY_URL: serverConfig.wechatPay.notifyUrl
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing WeChat Pay config: ${missing.join(", ")}`);
  }
}
