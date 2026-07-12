export {};

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke(
        name: "getBrandWCPayRequest",
        params: {
          appId: string;
          timeStamp: string;
          nonceStr: string;
          package: string;
          signType: "RSA";
          paySign: string;
        },
        callback: (response: { err_msg?: string }) => void
      ): void;
    };
  }
}
