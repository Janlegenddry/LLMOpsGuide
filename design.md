# Design — LLMOpsGuide

LLMOpsGuide 的整站设计系统。所有页面在改动视觉层之前先读取本文件；页面之间共享颜色、字体、间距和交互语言，不按页面重新选择主题。

## Genre

Editorial，偏 docs / reference。视觉目标不是产品宣传，而是一本可快速检索、可长时间阅读的工程手册。

## Audience · use · tone

- Audience：模型基础设施、推理服务、可观测性与运维工程师。
- Use：定位主题、搜索文章、沿学习路线阅读，并在长文中快速跳到目标章节。
- Tone：克制、技术化、清醒；不用装饰性科技感。

## Macrostructure family

- 首页：**Ecosystem Index**。用“开始学习 / 最近更新 / 按主题浏览”三个发现入口组织内容。
- 内容页：**Long Document**。正文是主角，右侧页内目录只承担定位。
- 搜索与工具界面：**Workbench**。状态、结果和快捷键优先，不加入营销文案。

## Theme

Almanac。浅色为带少量冷青的纸张色，深色为蓝黑石墨；青绿色只用于定位、当前状态和链接，单屏占比不超过 5%。

- `--color-paper`：`oklch(98% 0.006 210)`
- `--color-paper-2`：`oklch(96% 0.009 210)`
- `--color-paper-3`：`oklch(93% 0.012 210)`
- `--color-ink`：`oklch(21% 0.020 248)`
- `--color-ink-2`：`oklch(34% 0.018 248)`
- `--color-rule`：`oklch(87% 0.014 220)`
- `--color-accent`：`oklch(47% 0.105 205)`
- `--color-focus`：`oklch(45% 0.135 205)`

## Typography

- Display：Space Grotesk，700，normal。
- Body：Inter，400 / 600。
- Mono：JetBrains Mono，400。
- Display tracking：`-0.035em`。
- 正文宽度：`68ch`；正文基准字号：`1.0625rem`。
- 中文标题不使用斜体；英文缩写保留原始大小写。

## Spacing

采用 4px 命名尺度，定义在 `tokens.css`。页面只引用 `var(--space-*)`，不在组件里临时发明间距。

## Motion

- `--ease-out`：`cubic-bezier(0.16, 1, 0.3, 1)`。
- 只动画 `transform` 与 `opacity`。
- 页面不做滚动入场动画；侧栏抽屉与搜索弹窗可以淡入、平移。
- `prefers-reduced-motion` 下压缩为不超过 150ms 的透明度变化。

## Microinteractions stance

- 成功状态静默呈现，不弹庆祝 toast。
- 搜索打开后直接聚焦输入框；关闭后焦点回到触发按钮。
- 当前文章、当前章节和当前主题使用同一个 accent 语言。
- 所有窄屏点击目标不小于 44 × 44px。

## CTA voice

- Primary CTA：无渐变、低圆角、明确动词。
- Secondary CTA：文本链接加短箭头，不使用大面积描边胶囊。

## Navigation and footer

- Navigation：**N3 Side-rail**。桌面端为固定知识导航，移动端折叠为抽屉。
- Footer：**Ft1 Mast-headed**。用一句维护承诺收尾，保留 GitHub 与知识索引入口。

## Per-page allowances

- 首页允许使用真实内容数量与更新时间，不虚构指标。
- 内容页只使用排版、表格、代码块和 callout，不加入装饰图片。
- 搜索界面只显示真实文章数据。

## What pages MUST share

- LLMOpsGuide 字标与方形 `L` 标记。
- 青绿 accent 的使用位置。
- Space Grotesk / Inter / JetBrains Mono 字体角色。
- 低圆角、细分隔线和紧凑工具控件。
- 导航当前态、键盘焦点和链接反馈。

## What pages MAY differ on

- 首页可使用两栏索引；文章页保持单一正文流。
- 长文章出现页内目录，短文章允许目录自动隐藏。
- 表格可以横向滚动；普通正文不得产生横向滚动。

## Exports

### tokens.css

```css
:root {
  --color-paper: oklch(98% 0.006 210);
  --color-paper-2: oklch(96% 0.009 210);
  --color-paper-3: oklch(93% 0.012 210);
  --color-ink: oklch(21% 0.020 248);
  --color-ink-2: oklch(34% 0.018 248);
  --color-rule: oklch(87% 0.014 220);
  --color-accent: oklch(47% 0.105 205);
  --color-focus: oklch(45% 0.135 205);
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --radius-card: 0.5rem;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(98% 0.006 210);
  --color-paper-2: oklch(96% 0.009 210);
  --color-ink: oklch(21% 0.020 248);
  --color-accent: oklch(47% 0.105 205);
  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(98% 0.006 210)", "$type": "color" },
    "ink": { "$value": "oklch(21% 0.020 248)", "$type": "color" },
    "accent": { "$value": "oklch(47% 0.105 205)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Space Grotesk, ui-sans-serif, system-ui, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Inter, ui-sans-serif, system-ui, sans-serif", "$type": "fontFamily" },
    "mono": { "$value": "JetBrains Mono, ui-monospace, monospace", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 98% 0.006 210;
  --foreground: 21% 0.020 248;
  --primary: 47% 0.105 205;
  --primary-foreground: 98% 0.006 210;
  --muted: 93% 0.012 210;
  --muted-foreground: 46% 0.018 248;
  --border: 87% 0.014 220;
  --input: 87% 0.014 220;
  --ring: 45% 0.135 205;
  --radius: 0.5rem;
}
```
