// Narrow role contracts for original public teaching figures; coordinates remain 0–3.
export const frontierContracts = {
  "lookup-rpc-failure-boundaries": {
    "roles": [
      [
        "req"
      ],
      [
        "recv",
        "handler",
        "recverr"
      ],
      [
        "timeout",
        "close"
      ],
      [
        "miss",
        "next"
      ]
    ],
    "tones": [
      "control",
      "communication",
      "control",
      "neutral"
    ],
    "positions": {
      "req": [
        0,
        0
      ],
      "recv": [
        1,
        0
      ],
      "handler": [
        2,
        0
      ],
      "miss": [
        3,
        0
      ],
      "recverr": [
        2,
        1
      ],
      "timeout": [
        1,
        2
      ],
      "close": [
        2,
        2
      ],
      "next": [
        3,
        2
      ]
    },
    "edges": [
      [
        "req",
        "recv"
      ],
      [
        "recv",
        "handler"
      ],
      [
        "handler",
        "miss"
      ],
      [
        "recv",
        "recverr"
      ],
      [
        "req",
        "timeout"
      ],
      [
        "timeout",
        "close"
      ],
      [
        "close",
        "next"
      ]
    ]
  },
  "conv-checkpoint-window": {
    "roles": [
      [
        "prefix"
      ],
      [
        "old-write",
        "old-state",
        "old-read"
      ],
      [
        "new-write",
        "new-state",
        "new-read"
      ]
    ],
    "tones": [
      "neutral",
      "danger",
      "kv"
    ],
    "positions": {
      "prefix": [
        0,
        1
      ],
      "old-write": [
        1,
        0
      ],
      "old-state": [
        2,
        0
      ],
      "old-read": [
        3,
        0
      ],
      "new-write": [
        1,
        2
      ],
      "new-state": [
        2,
        2
      ],
      "new-read": [
        3,
        2
      ]
    },
    "edges": [
      [
        "prefix",
        "old-write"
      ],
      [
        "old-write",
        "old-state"
      ],
      [
        "old-state",
        "old-read"
      ],
      [
        "prefix",
        "new-write"
      ],
      [
        "new-write",
        "new-state"
      ],
      [
        "new-state",
        "new-read"
      ]
    ],
    "fixedExample": {
      "prefix": {
        "label": "同一个合成checkpoint：p=40",
        "detail": "原创索引示意：忽略批内起点，q=0；x_t是第t个卷积前激活向量，不是token ID。逻辑历史W=3，物理容量P=6，输入范围足够长。数字仅帮助检查索引，非实测。",
        "subtitle": "K=4，S=3"
      },
      "old-write": {
        "label": "旧写入长度误取P=6",
        "detail": "教学旧路径：按物理容量取x_34至x_39，顺序写进6个槽。该路径用于表现旧实现的索引结果，不代表线上抓取的张量。",
        "subtitle": "窗口起点34"
      },
      "old-state": {
        "label": "旧槽位：[34,35,36 | 37,38,39]",
        "detail": "数字是激活的输入位置标签。竖线只标示读者的逻辑窗口边界；物理上仍是一行。正确最近历史虽出现在后部，但首读窗口仍落在前部。",
        "subtitle": "前三区间偏旧"
      },
      "old-read": {
        "label": "首窗口拿到34、35、36",
        "detail": "在读者从槽0取3项的前提下，实际读取位置比目标37、38、39分别早3步。此图止于状态错误，不承诺每次都产生可见错误答案。",
        "subtitle": "偏旧3步"
      },
      "new-write": {
        "label": "修复写入逻辑W=3",
        "detail": "教学新路径：选择最近3项；物理地址步长仍按原行布局计算。扩大可分配槽数不应改变这一时间窗口。",
        "subtitle": "窗口起点37"
      },
      "new-state": {
        "label": "新槽位：[37,38,39 | 保留原值]",
        "detail": "尾部不是强制归零。图中的保留原值表示本次checkpoint导出不写该区域；尾部何时可被后续路径读写，必须按实际恢复与投机更新生命周期验证。",
        "subtitle": "尾部不写入"
      },
      "new-read": {
        "label": "首窗口拿到37、38、39",
        "detail": "在同一首读前提下，最近历史位置正确。SSM状态、目标block身份、后续更新、任务答案和平台支持是另外的验收项，不由这一箭头自动证明。",
        "subtitle": "历史身份吻合"
      }
    }
  },
  "verify-plan-dispatch": {
    "roles": [
      [
        "batch"
      ],
      [
        "promise",
        "stockplan",
        "hintplan",
        "gates"
      ],
      [
        "stock",
        "split",
        "merge"
      ],
      [
        "replay"
      ]
    ],
    "tones": [
      "control",
      "control",
      "compute",
      "neutral"
    ],
    "positions": {
      "batch": [
        0,
        0
      ],
      "promise": [
        1,
        0
      ],
      "stockplan": [
        1,
        1
      ],
      "hintplan": [
        1,
        2
      ],
      "gates": [
        1,
        3
      ],
      "stock": [
        2,
        0
      ],
      "split": [
        2,
        1
      ],
      "merge": [
        2,
        2
      ],
      "replay": [
        3,
        0
      ]
    },
    "edges": [
      [
        "batch",
        "promise"
      ],
      [
        "promise",
        "stockplan"
      ],
      [
        "promise",
        "hintplan"
      ],
      [
        "stockplan",
        "stock"
      ],
      [
        "hintplan",
        "gates"
      ],
      [
        "gates",
        "stock"
      ],
      [
        "gates",
        "split"
      ],
      [
        "split",
        "merge"
      ],
      [
        "merge",
        "replay"
      ],
      [
        "stock",
        "replay"
      ]
    ]
  },
  "gpu-fractioning-boundaries": {
    "roles": [
      [
        "request",
        "parse",
        "memory-error",
        "compute-error"
      ],
      [
        "adjust",
        "reject",
        "no-adjust",
        "fallback"
      ],
      [
        "runtime",
        "driver",
        "application",
        "mapping"
      ],
      [
        "metrics",
        "slo",
        "verify"
      ]
    ],
    "tones": [
      "control",
      "control",
      "compute",
      "neutral"
    ],
    "positions": {
      "request": [
        0,
        0
      ],
      "parse": [
        0,
        1
      ],
      "memory-error": [
        0,
        2
      ],
      "compute-error": [
        0,
        3
      ],
      "adjust": [
        1,
        0
      ],
      "reject": [
        1,
        1
      ],
      "no-adjust": [
        1,
        2
      ],
      "fallback": [
        1,
        3
      ],
      "runtime": [
        2,
        0
      ],
      "driver": [
        2,
        1
      ],
      "application": [
        2,
        2
      ],
      "mapping": [
        2,
        3
      ],
      "metrics": [
        3,
        0
      ],
      "slo": [
        3,
        1
      ],
      "verify": [
        3,
        2
      ]
    },
    "edges": [
      [
        "request",
        "parse"
      ],
      [
        "parse",
        "adjust"
      ],
      [
        "parse",
        "memory-error"
      ],
      [
        "parse",
        "compute-error"
      ],
      [
        "memory-error",
        "reject"
      ],
      [
        "memory-error",
        "no-adjust"
      ],
      [
        "compute-error",
        "reject"
      ],
      [
        "compute-error",
        "fallback"
      ],
      [
        "fallback",
        "adjust"
      ],
      [
        "adjust",
        "runtime"
      ],
      [
        "runtime",
        "driver"
      ],
      [
        "driver",
        "application"
      ],
      [
        "adjust",
        "mapping"
      ],
      [
        "no-adjust",
        "mapping"
      ],
      [
        "mapping",
        "metrics"
      ],
      [
        "application",
        "slo"
      ],
      [
        "metrics",
        "verify"
      ],
      [
        "slo",
        "verify"
      ],
      [
        "no-adjust",
        "verify"
      ]
    ]
  },
  "gpu-fractioning-acceptance": {
    "roles": [
      [
        "identity",
        "limit",
        "observability",
        "business"
      ],
      [
        "stop",
        "cost"
      ]
    ],
    "tones": [
      "control",
      "neutral"
    ],
    "positions": {
      "identity": [
        0,
        0
      ],
      "limit": [
        1,
        0
      ],
      "observability": [
        2,
        0
      ],
      "business": [
        3,
        0
      ],
      "stop": [
        1,
        2
      ],
      "cost": [
        3,
        2
      ]
    },
    "edges": [
      [
        "identity",
        "limit"
      ],
      [
        "limit",
        "observability"
      ],
      [
        "observability",
        "business"
      ],
      [
        "identity",
        "stop"
      ],
      [
        "limit",
        "stop"
      ],
      [
        "observability",
        "stop"
      ],
      [
        "business",
        "stop"
      ],
      [
        "business",
        "cost"
      ]
    ]
  },
  "token-id-frontier": {
    "roles": [
      [
        "text",
        "candidate",
        "guard"
      ],
      [
        "reference",
        "apply",
        "compare"
      ],
      [
        "admit",
        "serve"
      ],
      [
        "stop"
      ]
    ],
    "tones": [
      "neutral",
      "compute",
      "neutral",
      "danger"
    ],
    "positions": {
      "text": [
        0,
        0
      ],
      "candidate": [
        0,
        1
      ],
      "guard": [
        0,
        2
      ],
      "reference": [
        1,
        0
      ],
      "apply": [
        1,
        1
      ],
      "compare": [
        1,
        2
      ],
      "admit": [
        2,
        0
      ],
      "serve": [
        2,
        1
      ],
      "stop": [
        3,
        0
      ]
    },
    "edges": [
      [
        "text",
        "candidate"
      ],
      [
        "candidate",
        "guard"
      ],
      [
        "guard",
        "apply"
      ],
      [
        "text",
        "reference"
      ],
      [
        "reference",
        "compare"
      ],
      [
        "apply",
        "compare"
      ],
      [
        "compare",
        "admit"
      ],
      [
        "admit",
        "serve"
      ],
      [
        "guard",
        "stop"
      ],
      [
        "compare",
        "stop"
      ]
    ]
  }
};
