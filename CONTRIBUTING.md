# 如何更新 LLMOpsGuide

日常更新只需要维护 Markdown 文章和 `src/data.ts`。推送到 `main` 后，GitHub Actions 会自动发布网站。

## 1. 拉取最新代码

```bash
git clone git@github.com:Janlegenddry/LLMOpsGuide.git
cd LLMOpsGuide
npm install
```

已经克隆过时：

```bash
git switch main
git pull --ff-only
```

## 2. 新增或修改文章

文章位于 `src/pages/`。按主题选择目录，例如：

```text
src/pages/
├── roadmap/
├── fundamentals/
├── inference/
└── observability/
```

新建 Markdown 文件时使用以下头信息：

```markdown
---
layout: ../../layouts/ArticleLayout.astro
title: 文章标题
description: 一句话说明这篇文章解决什么问题
section: 推理服务
updated: 2026-08-09
status: 持续更新
---

# 文章标题

正文从这里开始。
```

修改旧文章时，记得同步更新 `updated` 日期。

## 3. 把文章加入目录和搜索

编辑 `src/data.ts`：

- 在 `entries` 中增加文章标题、摘要、路径、分类、状态和更新时间。
- 如果文章属于学习主线，再在 `learningPath` 中增加或调整步骤。
- 新分类需要同时增加到 `sections`。

`src/data.ts` 中的文章路径保持以 `/` 开头，不要手动写 `/LLMOpsGuide`；构建时会自动添加站点基础路径。

## 4. 本地检查

```bash
npm run dev
```

浏览器打开终端显示的 `/LLMOpsGuide/` 地址，检查首页目录、文章链接、搜索和深色模式。提交前再运行：

```bash
npm run build
```

## 5. 提交并发布

```bash
git add src README.md CONTRIBUTING.md
git commit -m "docs: add <文章主题>"
git push origin main
```

推送后可以在仓库的 `Actions` 页面查看发布进度。工作流成功后，访问：

<https://janlegenddry.github.io/LLMOpsGuide/>

## 推荐的内容维护节奏

- 随手记录：先写事实、命令、日志和引用来源，不急着形成结论。
- 每周整理：把零散记录归入知识树，补齐背景、判断过程和适用边界。
- 每月校正：检查过期版本、失效链接和仍处于“计划中”的主题。
- 故障复盘：区分现场事实、代码事实、推断和最终根因，避免把猜测写成结论。
