---
layout: ../../layouts/ArticleLayout.astro
title: Metrics、Logs 与 Traces
description: 理解三类信号的职责，并用请求生命周期组织排障证据。
section: 可观测性
updated: 2026-08-09
status: 已发布
---

指标、日志和 Trace 不是三套独立工具。它们分别回答不同粒度的问题，最终要在同一条请求生命周期上汇合。

## 三类信号各自擅长什么

| 信号 | 最适合回答 | 典型限制 |
| --- | --- | --- |
| Metrics | 系统是否异常、何时开始、影响多大 | 聚合后丢失单请求细节 |
| Logs | 某个组件发生了什么事件 | 跨组件关联和时间顺序容易断裂 |
| Traces | 一次请求经过哪里、耗时在哪里 | 采样与埋点会留下盲区 |

发现故障时，常见顺序是用指标缩小时间和实例范围，用 Trace 找到异常阶段，再进入日志与运行时现场验证机制。

## 推理服务的观测对象

只看 HTTP QPS 和错误率不够。至少要覆盖四层：

### 请求层

- 输入与输出 token 数。
- TTFT、TPOT、端到端时延。
- 排队、Prefill、Decode 与后处理耗时。
- 超时、取消和错误分类。

### 调度层

- Running、Waiting 请求数。
- Batch 大小与 token budget 使用率。
- KV Cache 占用、命中与回收。
- 抢占、重调度和拒绝次数。

### 资源层

- GPU 利用率、显存、功耗与温度。
- CPU、内存、网络和磁盘。
- NCCL 通信耗时与异常。

### 依赖层

- 网关、服务发现、对象存储和外部工具调用。
- 各内部进程的心跳和 IPC 队列。

## 统一关联键

一次请求需要稳定的 `trace_id` 与 `rid`。前者适合跨服务关联，后者适合推理引擎内部定位。日志应同时携带时间、实例、进程角色、Rank 和模型版本，避免依赖文件名或人工记忆补全上下文。

```text
trace_id → gateway span → scheduler span → model execution → detokenizer span
                           └─ rid / dp_rank / tp_rank / model_revision
```

## 面板不能替代现场

面板适合回答趋势与相关性，但 Hang、死锁、忙等和通信停滞通常需要线程栈、GPU kernel、网络连接及多次采样。可观测系统应该支持从异常曲线快速跳到具体实例和请求，而不是把所有细节永久塞进指标标签。

好的可观测性不是“数据很多”，而是能以较低成本从异常现象走到可证伪的机制判断。
