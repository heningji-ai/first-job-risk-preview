import { navigateTo, useRoute } from "./lib/router";
import GoalFitFreeResultPage from "./pages/GoalFitFreeResultPage";
import GoalFitLandingPage from "./pages/GoalFitLandingPage";
import GoalFitResultPage from "./pages/GoalFitResultPage";
import GoalFitSharePage from "./pages/GoalFitSharePage";
import GoalFitTestPage from "./pages/GoalFitTestPage";
import GoalFitUnlockPage from "./pages/GoalFitUnlockPage";
import HomePage from "./pages/HomePage";
import ResultPage from "./pages/ResultPage";
import ResultPageV2Preview from "./pages/ResultPageV2Preview";
import TestPage from "./pages/TestPage";
import TestPageV2Preview from "./pages/TestPageV2Preview";

function App() {
  const route = useRoute();

  if (route.path === "/test-goal-fit-preview") return <GoalFitTestPage />;
  if (route.path === "/goal-fit-preview") return <GoalFitLandingPage />;
  if (route.path === "/goal-fit-share-preview") return <GoalFitSharePage />;
  if (route.path === "/goal-fit-unlock-preview") return <GoalFitUnlockPage />;
  if (route.path === "/result-goal-fit-free-preview") return <GoalFitFreeResultPage />;
  if (route.path === "/result-goal-fit-preview") return <GoalFitResultPage />;
  if (route.name === "home") return <HomePage />;
  if (route.name === "test") return <TestPage />;
  if (route.name === "test_v2_preview") return <TestPageV2Preview />;
  if (route.name === "result_v2_preview") return <ResultPageV2Preview />;
  if (route.name === "result") return <ResultPage testSessionId={route.testSessionId} />;

  return (
    <main className="app-shell">
      <section className="state-panel">
        <p className="eyebrow">页面不存在</p>
        <h1>没有找到这个页面</h1>
        <button className="primary-button" type="button" onClick={() => navigateTo("/")}>
          返回首页
        </button>
      </section>
    </main>
  );
}

export default App;
