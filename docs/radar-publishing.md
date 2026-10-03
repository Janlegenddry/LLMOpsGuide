# 观志 · AI Infra 公开知识发布

项目保持 Astro + GitHub Pages，公开仓库为 `Janlegenddry/LLMOpsGuide`，Pages 使用 `gh-pages`。工作区初始无未提交更改，未发现适用的 AGENTS.md 或项目 .agents/skills。

## 供两项现有监测任务接入

存储：`src/content/radar.json`，数组，每条记录 `schemaVersion: 1`。接口示例：`examples/radar-record.json`。导入命令：

```bash
npm run content:import -- /absolute/path/payload.json --dry-run
npm run content:import -- /absolute/path/payload.json
npm test
npm run build
```

payload 可以是单条记录、记录数组或 `{ "records": [...] }`。没有新内容时传 `[]`，不会生成空日报。`id` 是稳定的小写英文 slug；同一 `kind + 第一条 source URL` 不允许另起 ID。重复 payload 无磁盘改动；同 ID 更新必须保留来源和分类，旧 `reviewedAt` 不覆盖新版本。文件原子替换，导入锁避免并发丢失。正文只支持纯文本结构，页面自动转义，不接收 HTML/脚本。

## 内容边界

只提交公开资料的原创摘要，不完整转载。每条记录明确 `visibility: public` 与 `containsPrivateData: false`，事实段落必须关联已核对的原文。初始来源仅允许 LMSYS blog、SGLang 官方 GitHub/文档；不得把公司资料、现场日志、客户标识、访问凭证或私人笔记放进 payload。校验器不替代任务对公开范围的判断。

所有条目区分原文日期 `publishedAt` 与本次核对日期 `reviewedAt`。不得把老文的核对日期伪装成新发布。未读完的资料标为 `reading`，不要自动写成深度解读。

## 部署通道

已有本地 Git 身份可提交 `src/content/radar.json` 后 push 到 `main`，原有部署工作流发布构建产物。不要使用 `git add .`：每日更新只提交该内容文件。

新增 `.github/workflows/publish-content.yml` 接收 `workflow_dispatch` 的 `payload` 字符串，或 `repository_dispatch` 类型 `public-knowledge` 的 `client_payload.records`。工作流校验、测试、构建、仅提交内容文件并发布 `dist`；不创建任何新调度。手动 dispatch 示例：

```bash
gh workflow run publish-content.yml --repo Janlegenddry/LLMOpsGuide --ref main --raw-field payload="$(cat /absolute/path/payload.json)"
```

结构化 API 为 `POST /repos/Janlegenddry/LLMOpsGuide/actions/workflows/publish-content.yml/dispatches`，body 为 `{ "ref": "main", "inputs": { "payload": "序列化后的 JSON" } }`；或 `POST /repos/Janlegenddry/LLMOpsGuide/dispatches`，body 为 `{ "event_type": "public-knowledge", "client_payload": { "records": [] } }`。均使用任务已有的 GitHub 授权，勿将 token 写进 payload。首次接入先提交原样示例（应显示 unchanged），再检验一次公开记录更新的 commit、对应 workflow 和线上 JSON。

跨任务调用应通过结构化 API 字段提交 JSON，避免把模型输出拼进 shell。云任务可使用已有、已授权的 GitHub 连接调用 dispatch；本地 `gh` 身份不会自动传给云任务。没有该写入连接时，云端发布尚未启用，不能声称电脑离线仍可自动写入。Mac 离线时，本地命令不能执行；站点已有页面仍可访问。GitHub Actions 已接入的云端 dispatch 不依赖 Mac 在线。

GitHub Pages 是静态站，`/api/radar.json` 和 RSS 是只读输出，没有匿名写接口。无需 API key 或额外付费服务。部署 workflow 使用现有 `contents: write` 权限。

## 参考范围

参考 [AIHOT](https://github.com/KKKKhazix/AIHOT) 的摘要、主题、日报与来源聚合思路；独立实现，不复制其代码、Logo 或品牌。核对 [MIT LICENSE](https://github.com/KKKKhazix/AIHOT/blob/main/LICENSE) 与 [NOTICE](https://github.com/KKKKhazix/AIHOT/blob/main/NOTICE)：名称与 Logo 不随代码许可。资料摘要保留原文链接与所有权。
