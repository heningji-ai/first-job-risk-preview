import { useEffect } from "react";
import GoalFitHeader from "../components/GoalFitHeader";
import { navigateTo } from "../lib/router";

function buildFreeResultPath(): string {
  const params = new URLSearchParams(window.location.search);
  const sample = params.get("sample");
  const sessionId = params.get("session");

  if (sample === "high_fit") return "/result-goal-fit-free-preview?sample=high_fit&invite=1";
  if (sessionId) return `/result-goal-fit-free-preview?session=${encodeURIComponent(sessionId)}&invite=1`;

  return "/goal-fit-preview";
}

function GoalFitSharePage() {
  useEffect(() => {
    navigateTo(buildFreeResultPath());
  }, []);

  return (
    <main className="goal-fit-shell goal-fit-share-shell">
      <GoalFitHeader />
      <section className="goal-fit-panel goal-fit-result-empty">
        <p className="goal-fit-eyebrow">邀请优惠</p>
        <h1>正在打开邀请优惠</h1>
        <p>邀请优惠已经合并到免费结果页，请稍等。</p>
        <button className="primary-button" type="button" onClick={() => navigateTo(buildFreeResultPath())}>
          前往领取优惠
        </button>
      </section>
    </main>
  );
}

export default GoalFitSharePage;
