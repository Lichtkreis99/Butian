import "./styles.css";

import { XuanYeApp } from "./app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root element.");

try {
  new XuanYeApp(root);
} catch (error) {
  const message = error instanceof Error ? error.message : "未知错误";
  root.innerHTML = `
    <main class="fatal-error">
      <span>步天 · BUTIAN</span>
      <h1>本地数据未能启用</h1>
      <p>${message}</p>
    </main>
  `;
  throw error;
}
