import { useState } from "react";
import type { FormEvent } from "react";
import { buildApiUrl } from "../config/api";
import { navigateTo } from "../lib/router";

function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/api/admin/login"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        setError(response.status === 503 ? "管理员登录尚未配置。" : "账号或密码不正确。");
        return;
      }

      navigateTo("/admin");
    } catch {
      setError("暂时无法连接后台服务。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-shell admin-login-shell">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <p className="admin-eyebrow">第一份工作预演</p>
        <h1>管理员登录</h1>
        <label>
          账号
          <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="admin-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "正在登录..." : "登录后台"}
        </button>
      </form>
    </main>
  );
}

export default AdminLoginPage;
