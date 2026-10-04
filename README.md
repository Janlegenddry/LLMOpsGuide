# Guanzhi的图书馆

李观志的个人知识图书馆，收录文章、完整报告、白皮书与阅读资料。当前已有积累集中在 AI Infra，后续按真实内容扩展知识领域。项目保留 LLMOpsGuide 仓库名与基础路径，使用 Astro 构建并发布到 GitHub Pages。

首页提供统一搜索、学习路线与交互实验入口、最近更新、知识领域和专题；知识导航按领域、类型、主题与阅读状态筛选。搜索覆盖标题、摘要、主题、关键词及机构名称。白皮书目前为真实空目录，不包含示例文件。

- 知识导航：`/LLMOpsGuide/library/`；白皮书：`/LLMOpsGuide/knowledge/`；AI Infra：`/LLMOpsGuide/domains/ai-infra/`
- 图书馆与白皮书接入：[docs/knowledge-navigation.md](./docs/knowledge-navigation.md)

- 动态入口：<https://janlegenddry.github.io/LLMOpsGuide/radar/>
- 内容导入与持续发布：[docs/radar-publishing.md](./docs/radar-publishing.md)
- 完整报告格式与可导入示例：[docs/radar-report-format.md](./docs/radar-report-format.md)；正文、机制图、证据表及验证矩阵全部持久化。
- 已核验官方来源及主题范围：[docs/radar-official-sources.md](./docs/radar-official-sources.md)。
- 公开论文、博客、社区和新闻的显式引用字段：[docs/radar-public-citations.md](./docs/radar-public-citations.md)；核对原文不等于事实已验证。
- 只读输出：`/LLMOpsGuide/api/radar.json`、`/LLMOpsGuide/radar/feed.xml`

- 在线阅读：<https://janlegenddry.github.io/LLMOpsGuide/>
- 维护说明：[CONTRIBUTING.md](./CONTRIBUTING.md)

## 本地开发

```bash
nvm use 24
npm install
npm run dev
```

需要 Node 24；也可使用其他已有 Node 版本管理工具。

打开终端显示的地址。由于线上站点位于项目路径，本地地址通常是 `http://localhost:4321/LLMOpsGuide/`。

## 新增文章

在 `src/pages/` 对应目录中新建 Markdown 文件：

```markdown
---
layout: ../../layouts/ArticleLayout.astro
title: 文章标题
description: 一句话说明
section: 推理服务
updated: 2026-08-09
---

# 文章标题

正文从这里开始。
```

新增后同步更新 `src/data.ts`，首页目录与搜索框就会出现该文章。完整步骤见 `CONTRIBUTING.md`。

## 发布

推送到 `main` 分支后，GitHub Actions 自动构建并发布：

```text
https://janlegenddry.github.io/LLMOpsGuide/
```

工作流会构建 `dist` 并发布到 `gh-pages` 分支。仓库 `Settings → Pages → Build and deployment` 的 Source 需设置为 `Deploy from a branch`，分支选择 `gh-pages`、目录选择 `/ (root)`。
