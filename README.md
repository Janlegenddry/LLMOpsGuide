# Janlegenddry · LLMOps Notes

个人 LLMOps 系统化学习知识库，使用 Astro 构建并发布到 GitHub Pages。

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://localhost:4321`。

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

新增后同步更新 `src/data.ts`，首页目录与搜索框就会出现该文章。

## 发布

推送到 `main` 分支后，GitHub Actions 自动构建并发布：

```text
https://janlegenddry.github.io/
```

首次发布前，需要在仓库 `Settings → Pages → Build and deployment` 中将 Source 设为 `GitHub Actions`。
