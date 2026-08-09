---
layout: ../../layouts/ArticleLayout.astro
title: SGLang Hang 现场诊断方法
description: 从进程、GPU、Python/Native 栈和日志建立证据链。
section: 推理服务
updated: 2026-08-09
status: 持续更新
---

“服务 Hang 住”只是现象。诊断的目标是回答：系统还在做计算，还是卡在同步、通信、死循环或外部依赖；卡住的组件是谁；所有并行 Rank 是否处于同一个阶段。

## 先保住现场

不要先重启，也不要只截一张 GPU 利用率。第一轮采集应尽量在同一时间窗口完成：

```bash
date
ps -eLo pid,tid,stat,etime,pcpu,comm,args
nvidia-smi
nvidia-smi dmon -s pucvmet -c 5
ss -tpn
```

随后对 scheduler、detokenizer、HTTP server 等关键进程采集多次栈。单次栈只能说明瞬间位置，间隔采样才能区分“持续推进”和“重复停在同一位置”。

## 四层证据

### 1. 进程与线程

高 CPU 不等于健康。如果多个 TP scheduler 长时间接近满核，要继续判断它们是在有效推进、忙等，还是反复执行同一段逻辑。

关注：

- 线程状态是否长期为 Running。
- 相隔数秒的 native 栈是否完全一致。
- 各 TP Rank 的栈是否对称，是否有单 Rank 偏离。

### 2. GPU 与通信

GPU 利用率高可能来自持续 kernel、通信轮询或异常重复计算。将 GPU 进程、kernel 活跃度和 NCCL 状态与 CPU 栈对齐，避免把“设备繁忙”直接解释成“请求在推进”。

### 3. 请求日志

沿同一个 `rid` 找到最后一个确定事件：收到请求、进入 Prefill、开始 Decode、发送 token、结束请求。没有日志不自动等于某一步卡住，它也可能说明日志所在组件本身没有获得调度。

### 4. 健康检查链路

健康检查要拆成入口、scheduler、detokenizer 和响应返回几段。若 Prefill 有响应而 detokenizer 心跳长期不更新，入口存活并不能证明完整生成链路健康。

## 用时间线组织判断

| 时间 | 证据 | 可以确认 | 仍不能确认 |
| --- | --- | --- | --- |
| T0 | 最后一次正常请求结束 | 之前链路可用 | 异常尚未开始 |
| T1 | 健康请求被接收 | HTTP 入口仍工作 | 推理链路能完成 |
| T2 | scheduler 多 Rank 满 CPU | 线程持续运行 | 是否有效推进 |
| T3 | detokenizer 无心跳 | 输出链路未完成 | 根因一定在 detokenizer |

这种写法能防止把“最后看到报错的组件”误认成“最先发生故障的组件”。

## 根因结论应满足什么

一个可复核的结论至少包含：

1. 首个异常时间点和影响范围。
2. 卡住线程的稳定栈或重复执行路径。
3. 与代码提交、配置或输入特征的对应关系。
4. 能排除相邻组件的反证。
5. 修复后用同类负载复现与对照的结果。

如果只能证明 detokenizer 没有返回，应把结论写成“故障表现位于输出链路”，而不是直接写成“detokenizer 是根因”。
