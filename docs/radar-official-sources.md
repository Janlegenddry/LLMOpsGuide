# 每日 AI Infra 解读的官方来源范围

来源按 2026-10-03 核验清单扩展，代码在 `src/lib/radar-sources.mjs`。不接受任意 GitHub 仓库或相似域名。可校验的 URL / 来源名称 / 主题示例见 [radar-official-sources.json](../examples/radar-official-sources.json)；它是来源目录，不是新闻 payload，不应导入成为新记录。

## 精确 GitHub 仓库

仅 `github.com` 下这九个 owner/repo：`sgl-project/sglang`、`vllm-project/vllm`、`vllm-project/vllm-ascend`、`flashinfer-ai/flashinfer`、`kvcache-ai/Mooncake`、`NVIDIA/nccl`、`pytorch/pytorch`、`triton-lang/triton`、`ai-dynamo/dynamo`。仓库根、发布、PR、代码路径均可作为公开证据；同组织的其他仓库、个人 fork 和同名前缀不放行。仓库名大小写规范化到来源表，避免大小写生成重复知识。

## 精确网站及路径

| hostname | 允许的路径段 | 名称 |
| --- | --- | --- |
| lmsys.org / www.lmsys.org | /blog | LMSYS |
| docs.sglang.io | 全站 | SGLang 文档 |
| docs.vllm.ai | 全站；/projects/ascend 单独显示名称 | vLLM / vLLM Ascend 文档 |
| vllm.ai | /blog | vLLM 博客 |
| blog.vllm.ai | 全站，最终重定向需核验 | vLLM 博客旧入口 |
| docs.flashinfer.ai | 全站 | FlashInfer 文档 |
| kvcache-ai.github.io | /Mooncake | Mooncake 文档 |
| docs.nvidia.com | /deeplearning/nccl、/dynamo | NCCL / Dynamo 文档 |
| developer.nvidia.com | /blog | NVIDIA 技术博客 |
| pytorch.org | /blog | PyTorch 博客 |
| triton-lang.org | 全站 | Triton 文档 |

路径规则匹配段本身及其子路径，如 `/blog` 与 `/blog/...`，不匹配 `/blogger`；`/Mooncake` 不匹配 `/Mooncake-evil`。所有 URL 必须是 HTTPS、无用户名密码、无非默认端口、无查询参数。锚点去除、尾斜杠规范化，既有合法来源保留。

## 重定向和内容核验

导入器只校验来源格式和允许范围，不联网抓取。采集任务必须跟随重定向，核对最终 hostname / path 仍在上述范围内、页面确为官方公开资料，再把最终 URL 写入 payload。不能用官方入口包装一个跳转到其他站点的来源。2026-10-03 已核对 `https://blog.vllm.ai/` 根入口跳转到 `https://vllm.ai/blog`，因此仅这个根别名会静态规范化；文章级跳转不猜测映射，仍须核对并存入最终地址。保留原文日期，勿将查阅日期冒充发布时间。正文仍须按事实 / 作者结果 / 推导 / 待验证分级。

## 主题与发布契约

保留 `SGLang`、`GPU 通信`、`KV Cache`、`PD 分离`、`投机解码`、`故障分析`，新增 `vLLM`、`NPU/昇腾`、`推理编译`、`服务调度`、`分布式训练`。每条仍最多六个主题，选择真实相关项，不强行给非 SGLang 文章打 SGLang 标签，不使用任意自由标签。

继续使用 `schemaVersion: 1` 和完整 `report`；[完整报告接口](radar-report-format.md)及[既有发布通道](radar-publishing.md)不变。白名单扩展不会允许私有资料、凭证、无证据事实、缺失章节或静默截断，也不会增加抓取任务、调度、API 凭证或付费服务。未完成解读的内容继续显示“尚未解读”。
