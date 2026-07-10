import type { OrderRecord } from "./types.js";

export type WechatNativePaymentResult = {
  status: "not_implemented";
  message: string;
  order: OrderRecord;
};

export async function createWechatNativePayment(order: OrderRecord): Promise<WechatNativePaymentResult> {
  return {
    status: "not_implemented",
    message: "Wechat Pay Native payment is not implemented in this skeleton.",
    order
  };
}
