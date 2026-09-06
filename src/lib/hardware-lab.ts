export type CardSpec = {
  id: string; name: string; family: string; form: "module" | "pcie" | "concept";
  dies: number; memory: string; color: string; note: string; evidence: string;
};
export const cards: CardSpec[] = [
  { id: "h20", name: "NVIDIA H20", family: "Hopper · 模组视图", form: "module", dies: 1, memory: "96 GB · 官方支持列表", color: "#527e42", evidence: "型号与容量有公开依据；结构为教学重建", note: "以 SXM 类模组表现板对板连接、周边供电与上方散热器。不要把画面中的底部连接器当成 PCIe 插卡金手指。具体服务器的互联与散热配置另行确认。" },
  { id: "h20e", name: "H20-3e", family: "参考名称 · 模组示意", form: "module", dies: 1, memory: "144 GB · 参考配置，未独立核实", color: "#326c62", evidence: "参考名称，不作为厂商正式 SKU 认定", note: "沿用参考材料的 H20-3e 名称。容量标注用于阅读示例，不根据名称推导精确芯片、HBM 堆叠层数、带宽或交付形态；以板卡物料与厂商资料为准。" },
  { id: "910b", name: "昇腾 910B2C", family: "单计算 die · NPU 示意", form: "module", dies: 1, memory: "64 GB · 参考配置，未独立核实", color: "#9c683d", evidence: "参考配置；不复用现场部署与监控数值", note: "单计算 die 视图用来区分板卡、计算芯片与 HBM。HCCS 是硬件互联，HCCL 是集合通信库；板卡在槽位中的排列不等于实际通信拓扑。" },
  { id: "910c", name: "昇腾 910C", family: "双计算 die · 分区显存", form: "module", dies: 2, memory: "128 GB / 2 个计算 die · 论文 v2 口径", color: "#92553f", evidence: "双 die 结构有公开论文依据；几何非 CAD", note: "同一封装中展开两个计算 die 及其相邻 HBM 区。物理卡数、逻辑设备数与进程 rank 不一定相同；容量规划需明确软件可见的设备及内存域，不能只看整卡汇总。" },
  { id: "ppu", name: "PPU-ZW810E", family: "参考名称 · 长板示意", form: "pcie", dies: 1, memory: "96 GB · 参考配置，未独立核实", color: "#655887", evidence: "通用 PCIe 载板示意，不声称还原真实外观", note: "用长板、挡板、金手指与被动散热鳍片解释一类 PCIe 加速卡的结构。型号沿用参考名称；供电接口、封装与散热装置的准确位置尚无公开结构依据。" },
  { id: "l20x", name: "L20X（待识别）", family: "参考别名 · 不等同 H200", form: "module", dies: 1, memory: "准确容量与 SKU 待板卡确认", color: "#456e8e", evidence: "不从驱动 Name 或容量推断正式型号", note: "参考材料记录的是一个待确认名称。H200 官方公开 141 GB HBM3e，但这不能反向证明 L20X 就是 H200。本模型只保留通用模组形态，避免给不确定别名配上虚假的精确外观。" },
  { id: "950pr", name: "昇腾 950PR", family: "概念参考 · Prefill / 推荐", form: "concept", dies: 1, memory: "HiBL · 公开架构方向", color: "#967441", evidence: "公开架构参考；不代表发布或交付状态", note: "展示计算 die 与近封装存储的关系，不推断实际 die 数、HBM 颗数或板型。Prefill / 推荐定位来自公开介绍；本页不复述未经核验的后续交付计划。" },
  { id: "950dt", name: "昇腾 950DT", family: "概念参考 · Decode / 训练", form: "concept", dies: 1, memory: "存储配置以厂商交付资料为准", color: "#8b604e", evidence: "概念性结构，不将规划数字当实测", note: "与 950PR 对照观察计算与存储的角色，不把模型中统一的示意封装误认为两者物理设计完全一致。Decode / 训练定位不等于某模型的实测吞吐结论。" },
];
export const cardParts = [
  { id: "cooler", name: "散热组件", text: "鳍片扩大换热面积，热量经接触面 / 均热板传到气流或冷板。画面采用被动鳍片示意：服务器风扇推动空气，不意味着卡上必须带风扇。", watch: "关注温度、功耗、时钟与降频原因；温度高不等于计算利用率一定高。" },
  { id: "die", name: "计算 die", text: "真正执行矩阵运算、向量运算与控制逻辑的硅片。可视化中的网格只是功能区示意，不是 SM、AI Core 或晶体管的真实数量。", watch: "确认物理卡 → die → 逻辑设备 → rank 的映射；不同工具的设备粒度可能不同。" },
  { id: "hbm", name: "HBM 堆叠", text: "HBM 位于计算芯片附近，通过封装内的宽接口交换数据。层叠薄片表现堆叠概念，不代表实际层数；不能从画面格子数推导容量。", watch: "权重、KV Cache、激活与工作空间共同占用显存；可用容量与带宽都是约束。" },
  { id: "package", name: "封装与基板", text: "计算 die 和 HBM 集成到封装结构上，再连接板级电路。动画拆开是为了理解层次，真实器件并不是可随意拔下的积木；禁止按动画拆机。", watch: "封装互联、板级 PCIe、卡间高速互联是不同层次，不应画成同一种总线。" },
  { id: "power", name: "供电与 PCB", text: "PCB 承载电路走线；电感、电容与供电级把输入电源转换为芯片需要的电压。细线只是布线示意，并非可用于制造或维修的电路图。", watch: "核对功率限制、供电状态、PCIe 链路与槽位信息，不从外观推断全部能力。" },
  { id: "connector", name: "板级连接器", text: "模组通过板对板连接器接到底板；PCIe 插卡通过金手指连接插槽。物理形态与协议不是同一件事：模组同样可能承载 PCIe 与专用互联信号。", watch: "链路速率、宽度、Root Port / Switch / 端点路径，以实际 PCIe 拓扑和服务器资料为准。" },
] as const;
export type HardwareStep = { title: string; text: string; part: string; explode: number; route: string; kind: "idle" | "control" | "data" | "error" | "complete"; progress: number; mr: string; ready: boolean };
export function cardTour(card: CardSpec): HardwareStep[] {
  return [
    ["先看整块卡的装配层次", card.note, "connector", 0],
    ["抬起散热器，露出封装", "沿散热组件 → 导热接触面 → 封装观察热量路径。拉动拆解滑杆可停在任意位置，拖动场景可查看侧面。", "cooler", 100],
    [card.dies === 2 ? "同一个封装，两个计算 die" : "定位计算 die", card.dies === 2 ? "两个计算 die 并排呈现；旁边的 HBM 按内存区域分组。双 die 不自动意味着每个应用都看到一个统一显存池。" : "从板卡进入封装，看到中央计算区域。概念型号的 die 数只是占位示意，不能作为产品规格。", "die", 75],
    ["权重从 HBM 进入计算单元", "金色移动光点表示数据从近封装存储流向计算 die。真实设备由多级缓存和片上互联共同服务，不是 HBM 与计算单元之间的一根独占线。", "hbm", 75],
    ["再回到供电与板级连接", "金色接触点、灰色电感和绿色 PCB 是不同职责的部件。数据链路与供电回路要分开理解。", "power", 40],
    ["合拢，建立从外观到计算的对应", "完成本卡的结构导览。可换另一卡型比较双 die 与单 die、模组与插卡；所有外形、尺寸和部件排布均为教学重建。", "connector", 0],
  ].map(([title, text, part, explode], i) => ({ title: String(title), text: String(text), part: String(part), explode: Number(explode), route: i === 3 ? "memory" : "", kind: i === 3 ? "data" : "idle", progress: 0, mr: "—", ready: false }));
}
export const rforkParts = [
  { id: "source-gpu", name: "源 GPU / HBM", text: "保存待复制权重的源 GPU。传输期间源缓冲区必须继续有效；并不是把一个 GPU 的执行上下文原样克隆成另一台服务器的进程。", watch: "源缓冲区版本、大小、注册与引用生命周期。" },
  { id: "source-nic", name: "源 HCA", text: "RDMA 网络适配器，经受支持的 PCIe 路径读取源 GPU 显存，再把权重数据发送到网络。", watch: "端口状态、网络拥塞、重传与 RDMA 完成状态。" },
  { id: "network", name: "网络交换机", text: "连接两台服务器的 RDMA 网络。本场景用一台交换机表示网络路径，不代表生产部署必须采用该层级、端口数或线缆制式。", watch: "端到端有效带宽、拥塞与丢包，不能只看网卡标称线速。" },
  { id: "target-nic", name: "目标 HCA", text: "本示例由目标端提交 RDMA READ。请求方向指向源端，权重数据则反方向回到目标；不要把 READ 的命令方向与数据方向画反。", watch: "WR 提交、CQE 完成、错误状态及重试次数。" },
  { id: "switch", name: "PCIe Switch", text: "在 CPU Root Complex 与多个 PCIe 端点之间转发事务。两块设备共用 Switch 不等于物理上共用同一条下行链路；实际可达性受拓扑、ACS/IOMMU 与平台支持约束。", watch: "AER、链路宽度 / 速率、上游端口和端点路径，区分报告位置与错误来源。" },
  { id: "target-gpu", name: "目标 GPU / HBM", text: "接收新进程将使用的权重。GPUDirect RDMA 可绕开 CPU DRAM 作为数据中转，但 CPU 仍参与资源管理、提交与同步。", watch: "容量、完成屏障、数据可见性和模型就绪时刻。" },
  { id: "cpu", name: "CPU 与主存", text: "CPU 运行加载器和驱动，管理 MR、QP、WR 及完成队列。数据面直达 GPU 不是 CPU 完全不参与；非 GDR 路径还可能需要主存暂存。", watch: "控制面开销、注册失败、主存暂存与超时取消。" },
] as const;
export function rforkTour(failure = false): HardwareStep[] {
  const steps: HardwareStep[] = [];
  const add = (title: string, text: string, part: string, route: string, kind: HardwareStep["kind"], progress: number, mr: string, ready = false) => steps.push({title,text,part,route,kind,progress,mr,ready,explode:65});
  add("源副本已有权重，目标进程开始加载", "R-Fork 在本页特指参考材料中的权重获取工作流，不是硬件接口，也不等于操作系统 fork。两台服务器只各展开一条 GPU ↔ HCA 路径，其余加速卡作为整机背景。", "cpu", "", "idle", 0, "未注册");
  add("登记源与目标内存，确认兼容路径", "为 GPU 缓冲区建立可访问的 MR，并在有效期内保持地址、访问权限和相关密钥有效。验证 GPUDirect、驱动与 PCIe 拓扑支持；不能仅因有 RDMA 网卡就默认可直达显存。", "target-gpu", "setup", "control", 0, "有效 / 已登记");
  add("目标端建立 QP，提交 RDMA READ", "目标加载器提交工作请求 WR；READ 请求经目标 HCA → 网络 → 源 HCA。青蓝色光点现在是控制 / 请求方向，不是权重已经到达。", "target-nic", "request", "control", 0, "有效 / WR 在途");
  add("源 HCA 经 PCIe 读取源 GPU HBM", "源端网卡通过受支持的 peer-to-peer 路径取得已注册的源显存数据。源缓冲区此时必须保持有效；CPU 负责协调，但本例数据不经 CPU DRAM 暂存。", "source-gpu", "source", "data", 0, "有效 / WR 在途");
  add("权重穿过网络，回到目标端", "金色光点表示权重分片，方向与 READ 请求相反：源 GPU → 源 HCA → 网络交换机 → 目标 HCA。画面中的分片和百分比是教学进度，不是吞吐采样。", "network", "network", "data", 45, "有效 / WR 在途");
  if (failure) {
    add("风险分支：在途访问的 MR 生命周期失配", "假设传输未完成就尝试释放相关显存 / 注销注册。此处展示生命周期错误风险，不声称它必然产生 Malformed TLP 或 kernel panic。错误表现取决于驱动、访问保护和硬件。", "switch", "blocked", "error", 45, "生命周期失配");
    add("阻止就绪，完成清理后重新登记", "先按实现的取消 / drain / 同步协议结束在途访问，确认旧缓冲区不再被访问，再重建传输状态。不能在旧 WR 仍可能访问时直接释放或覆盖内存。此演示选择清理后整段重传。", "cpu", "", "control", 0, "重建有效 MR");
    add("重新提交 READ，重传完整示例", "重试关联同一个加载任务，但采用新的有效传输状态；目标模型尚未被标成 Ready。重试必须受超时和预算约束，无法恢复时应明确失败。", "target-nic", "request", "control", 0, "有效 / 重试在途");
    add("权重重新沿源到目标方向传输", "恢复后的传输再次读取源 HBM，通过 RDMA 网络到达目标。本页不会将参考故障报告中的现场统计和未经确认的根因搬到公开动画中。", "network", "network", "data", 45, "有效 / 重试在途");
  }
  add("目标 HCA 经 PCIe 写入目标 HBM", "从目标网卡经 PCIe Switch 到目标 GPU；数据直达目标显存。进度 100% 只表示本动画的字节到位阶段，还没有跨过所有完成与可见性检查。", "target-gpu", "target", "data", 100, "有效 / 等待完成");
  add("检查完成状态与 GPU 数据可见性", "检查所有传输的完成状态，执行平台要求的同步与内存可见性保证，并完成加载器的校验。一个成功 CQE 不应被随意等同为所有 GPU kernel 已可安全读取。", "cpu", "", "control", 100, "有效 / 已完成");
  add("模型就绪后，才允许接收推理请求", "加载器确认模型结构与权重对应、必要同步和初始化已完成，才发布 Ready。MR 可按实现保留复用，或在无在途访问后安全解除；GPU 权重仍需留给推理使用。", "target-gpu", "", "complete", 100, "安全保留 / 解除", true);
  return steps;
}
