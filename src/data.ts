export type NoteEntry = {
  title: string;
  description: string;
  href: string;
  section: string;
  status: "已发布" | "持续更新" | "计划中";
  updated?: string;
};

export const sections = [
  {
    id: "roadmap",
    title: "学习路线",
    description: "先建立 LLMOps 全局地图，再逐层深入模型、推理、可观测性与平台工程。",
  },
  {
    id: "fundamentals",
    title: "基础体系",
    description: "理解模型生命周期、GPU 资源、分布式计算和生产环境中的关键约束。",
  },
  {
    id: "infrastructure",
    title: "基础设施",
    description: "从 GPU/NPU 板卡、HBM 与 PCIe 拓扑，到 RDMA 网络和模型权重加载。",
  },
  {
    id: "inference",
    title: "推理服务",
    description: "围绕 SGLang、调度、KV Cache、并行策略与性能调优积累实践。",
  },
  {
    id: "observability",
    title: "可观测性",
    description: "从指标、日志和 Trace 还原请求生命周期，建立可复用的诊断方法。",
  },
] as const;

export const learningPath = [
  {
    index: "1.0",
    title: "建立全局地图",
    description: "理解 LLMOps 解决什么问题，以及训练、评测、部署、推理和运维之间的关系。",
    href: "/roadmap/llmops-roadmap/",
  },
  {
    index: "2.0",
    title: "掌握基础约束",
    description: "补齐模型生命周期、GPU、分布式通信和服务化基础。",
    href: "/fundamentals/model-lifecycle/",
  },
  {
    index: "3.0",
    title: "深入推理系统",
    description: "理解 Prefill/Decode、Batching、KV Cache、投机解码和多卡并行。",
    href: "/inference/sglang-hang-diagnosis/",
  },
  {
    index: "4.0",
    title: "形成诊断闭环",
    description: "把指标、日志、Trace 和现场采样串成可复现、可证伪的排障流程。",
    href: "/observability/three-pillars/",
  },
] as const;

export const entries: NoteEntry[] = [
  {
    title: "加速卡与 R-Fork：硬件 3D 实验室",
    description: "旋转、拆解 8 个卡型 / 概念视图，跟随 GPU、HBM、HCA 与 PCIe 上的跨机权重传输。",
    href: "/infrastructure/hardware-3d/",
    section: "基础设施",
    status: "已发布",
    updated: "2026-09-06",
  },
  {
    title: "一次大模型推理的旅程",
    description: "交互动画：从 prompt 到 token，深入 Transformer、投机解码、前缀复用与 Prefill/Decode 分离。",
    href: "/observability/inference-animation/",
    section: "可观测性",
    status: "已发布",
    updated: "2026-09-06",
  },
  {
    title: "LLMOps 系统化学习路线",
    description: "从模型生命周期到生产运维的知识地图与推荐学习顺序。",
    href: "/roadmap/llmops-roadmap/",
    section: "学习路线",
    status: "持续更新",
    updated: "2026-08-09",
  },
  {
    title: "模型生命周期与 LLMOps 边界",
    description: "训练、评测、部署、推理和反馈闭环分别解决什么问题。",
    href: "/fundamentals/model-lifecycle/",
    section: "基础体系",
    status: "已发布",
    updated: "2026-08-09",
  },
  {
    title: "SGLang Hang 现场诊断方法",
    description: "从进程、GPU、Python/Native 栈和日志建立证据链。",
    href: "/inference/sglang-hang-diagnosis/",
    section: "推理服务",
    status: "持续更新",
    updated: "2026-08-09",
  },
  {
    title: "Metrics、Logs 与 Traces",
    description: "理解三类信号的职责，并用请求生命周期组织排障证据。",
    href: "/observability/three-pillars/",
    section: "可观测性",
    status: "已发布",
    updated: "2026-08-09",
  },
];
