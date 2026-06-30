import { useEffect, useState } from "react";
import { navigateTo } from "../lib/router";
import { getStoredSession } from "../lib/sessionStorage";
import type { StoredTestSession } from "../types/session";

type ResultPageProps = {
  testSessionId: string;
};

function ResultPage({ testSessionId }: ResultPageProps) {
  const [session, setSession] = useState<StoredTestSession | undefined>();

  useEffect(() => {
    setSession(getStoredSession(testSessionId));
  }, [testSessionId]);

  if (!session) {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <p className="eyebrow">未找到测试记录</p>
          <h1>这个结果暂时不可用</h1>
          <p>请回到首页重新开始一次测试。</p>
          <button className="primary-button" type="button" onClick={() => navigateTo("/")}>
            返回首页
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="result-panel" aria-labelledby="result-title">
        <p className="eyebrow">测试已完成</p>
        <h1 id="result-title">结果占位页</h1>
        <dl className="result-list">
          <div>
            <dt>testSessionId</dt>
            <dd>{session.id}</dd>
          </div>
          <div>
            <dt>已回答题目数量</dt>
            <dd>{Object.keys(session.answers).length}</dd>
          </div>
          <div>
            <dt>audienceType</dt>
            <dd>{session.audienceType}</dd>
          </div>
        </dl>
        <p className="inline-notice">评分与风险卡结果将在下一阶段接入</p>
        <button className="secondary-button" type="button" onClick={() => navigateTo("/")}>
          返回首页
        </button>
      </section>
    </main>
  );
}

export default ResultPage;
