# Guanzhi的图书馆：知识导航与白皮书接入

首页 `/` 提供统一搜索、真实阅读入口、最近更新、领域和专题；`/library/` 是全部馆藏，`/knowledge/` 是白皮书目录，`/domains/<id>/` 是领域页。原文章、`/radar/`、详情 ID、RSS、只读 API 和 `/#notes` / `/#path` 继续可用。所有站内路径由构建添加 `/LLMOpsGuide`，数据中不要重复写这个前缀。

唯一检索索引为 `src/library.ts`：长期文章来自 `src/data.ts`，完整报告及来源摘记来自 `src/content/radar.json`，白皮书来自 `src/content/knowledge.json`。一条完整报告只索引一次。首页、全局搜索和知识导航共享它；搜索范围是标题、摘要、主题、关键词与机构，不是 PDF 或文章全文。关键词以空格分隔时全部匹配，忽略大小写及全角字符。

领域、内容类型、主题与阅读状态分别筛选。当前真实领域只有 AI Infra；类型为文章、完整报告、白皮书、来源摘记。原三条 reading 记录显示“待解读”，不会因为进入目录变成完整报告。筛选写入 URL，刷新、返回和清除筛选保持一致。无 JavaScript 时全部目录与阅读链接仍可用。

## 增加领域与文章

在 `src/lib/library-taxonomy.ts` 的 `libraryDomains` 增加领域 ID、名称和摘要，领域页自动生成。在 `src/data.ts` 为文章设置可选 `domain`、`topics`、`keywords`；现有文章缺省为 `ai-infra`，主题沿用原 section。只有已有内容的领域在首页展示。不要为了未来可能的内容创建空学科列表。

## 白皮书元数据

目前 `src/content/knowledge.json` 为真实空数组。收到资料后，先核对来源、日期、格式、可公开范围及分发许可，再填写完整记录。未来文件的公开授权需单独确认；页面上线批准不代表批准公开用户之后提供的材料。所有放入 `public/` 的文件都会被静态站发布，私人原件应保存在仓库之外。

| 字段 | 规则 |
| --- | --- |
| schemaVersion / id | `1` / 唯一稳定英文 slug；修改原记录，不另起重复来源 |
| title / summary / institution | 标题、原创摘要、发布机构，不编造作者或背书 |
| publishedAt | 真实 `YYYY-MM-DD`，未知显式 `null`，页面显示“原文日期未标注” |
| addedAt | 实际收录日 `YYYY-MM-DD`，不早于原文日期；目录排序用它，避免旧资料新收录时被当成旧更新 |
| domain / topics / keywords | 已登记领域 ID；1–6 个主题；1–12 个关键词 |
| format | `PDF` 或 `HTML`，指阅读来源格式 |
| source | `{ "title": "来源名称", "url": "已核对的原始公开 HTTPS 地址" }` |
| readUrl | 已核对的公开外链，或 `/knowledge-files/<slug>/<file>.pdf` |
| downloadUrl | 可选；实际存在的原始下载外链或站内 PDF；没有下载地址时不显示下载按钮 |
| publicationApproved / containsPrivateData | 必须明确 `true` / `false`，表示这条资料已获准公开且不含私有资料 |
| distribution | `link-only`：仅指向原始来源；`redistributable`：已确认可再分发，才可托管文件 |

版权受限、没有再分发许可或超过 20 MiB 的资料使用 `link-only`，保留原站阅读 / 下载链接，不复制文件。外链只接受 HTTPS 公网域名与公开文献标识参数，拒绝凭证、签名下载地址、内网 / IP 与重定向参数。静态校验不联网，也不证明法律许可；接入时人工核对实际原文、最终跳转地址、许可和可访问性。

获准再分发的小型 PDF 放在 `public/knowledge-files/<slug>/`。文件名使用英文字母、数字、下划线或短横线。构建校验真实 PDF 头、大小、存在性及目录边界；拒绝符号链接和该目录中未登记文件，避免把未批准原件悄悄复制到站点。本地 HTML 不托管；HTML 格式只链接到原始发布站。

```bash
npm run knowledge:verify
npm test
npm run build
npm run library:verify
npm run content:verify
git diff --check
```

使用 Node 24。验证后只暂存本次获准公开的元数据、文件与相关代码，沿用已有 main → GitHub Pages 发布流程。不要把测试样例、私人目录或整个文件夹随手提交。无需后台、账号、数据库、上传按钮、凭证或新调度。
