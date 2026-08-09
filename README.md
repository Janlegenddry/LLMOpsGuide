# LLMOpsGuide

面向大模型运维的系统学习知识库，覆盖模型生命周期、推理服务、可观测性与生产实践。使用 Astro 构建并发布到 GitHub Pages。

- 在线阅读：<https://janlegenddry.github.io/LLMOpsGuide/>
- 维护说明：[CONTRIBUTING.md](./CONTRIBUTING.md)

## 本地开发

```bash
npm install
npm run dev
```

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
