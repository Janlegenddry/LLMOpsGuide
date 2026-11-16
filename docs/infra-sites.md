# 优秀 Infra 网站

入口 `/LLMOpsGuide/infra-sites/`；首页、知识导航与侧栏均可到达。

后续追加或复核只编辑 `src/content/infra-sites.json`。沿用稳定 ID，保留原站链接、类型、维护者、短中文介绍、主题、来源仓库（未知填 null）与真实核验日期；重复站点更新原记录。仅收录已授权公开且不含私人信息的阅读入口，不复制文章、嵌入站点或接入采集。

更新频率须明确归属于原项目，不承诺本站同步文章或原站持续可用。链接使用无凭证、无追踪参数的公开 HTTPS 原始地址；需要参数的地址先审查，不去掉内容身份参数冒充原址。

使用 Node 24 运行 `npm test`、`npm run build`、`npm run library:verify`、`npm run events:verify`、`npm run content:verify`、`npm run jobs:verify`、`git diff --check`。现有 library 校验会核对本目录数据、完整正文、外站链接和首页入口，条目数随数据变化，不固定为首发数量。

同仓库串行发布，先核对 main、工作区和运行中 CI。普通更新只提交该数据文件，push 现有 main，等待对应 CI 与 Pages 成功，再完整读回首页、知识导航和子页并对比构建值。实际浏览器核对桌面、窄屏、键盘焦点和外链；未测项如实记录。不新增定时任务、不改已有自动化、凭证或权限。
