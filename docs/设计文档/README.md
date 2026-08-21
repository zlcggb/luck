# VIP Unilumin Web 平台前端标准设计文档体系

> **版本**：v1.0.0  
> **更新时间**：2026-08-20  
> **项目架构**：Astro 5 + React 18 + Tailwind CSS 3.4 + Supabase  
> **代码路径**：`src/react-app/`  
> **美学定位**：Apple 极简精致设计语言（Apple Design Language） × 高端科技工业风

---

## 1. 文档体系导览

本设计文档库全面解构与规范了 `astro-vip-unilumin-com` 前端应用的设计系统、基础组件、弹窗对话框、核心业务模块、动效以及可访问性标准，旨在为产品经理、UI/UX 设计师与前端工程师提供统一、权威的工程与视觉指南。

| 序号 | 文档名称 | 核心内容概要 | 适用角色 |
| :--- | :--- | :--- | :--- |
| **01** | [01-设计系统总纲与设计语言.md](./01-设计系统总纲与设计语言.md) | 美学哲学、设计原则、设计令牌（色彩/流体排版/间距/阴影/圆角/层级）、明暗主题规范 | 全员 / 视觉 / 前端 |
| **02** | [02-基础与通用组件设计规范.md](./02-基础与通用组件设计规范.md) | 按钮、输入框、卡片、徽章、骨架屏、加载状态、顶部导航头、移动端菜单、悬浮胶囊栏 | UI 设计 / 前端开发 |
| **03** | [03-弹窗与对话框设计规范.md](./03-弹窗与对话框设计规范.md) | 弹窗分级交互模型、全局合规弹窗（Cookie/GDPR/年龄/隐私）、业务弹窗（规格对比/工程保存/外设/案例预览/PPT 导出） | 交互设计 / 前端开发 |
| **04** | [04-核心业务模块设计规范.md](./04-核心业务模块设计规范.md) | 沉浸式首页、LED 配置器（3D/多面屏/走线/BOM）、营销案例中心、全球预约、培训直播、动态表单、后台管理、AI Agent | 架构师 / 业务前端 / PM |
| **05** | [05-动效、响应式与可访问性规范.md](./05-动效、响应式与可访问性规范.md) | 贝塞尔缓动曲线、页面转场、全端流体响应式、移动端 Safe Area 适配、WCAG 2.1 AA 级合规、交付检查清单 | 前端开发 / QA / 审查 |

---

## 2. 源码与设计系统对照表

设计文档中的所有规范均与项目代码库实现 1:1 严密映射：

```
docs/设计文档/
├── README.md                                  # [本文件] 设计系统导航索引
├── 01-设计系统总纲与设计语言.md                   # 对应 src/react-app/styles/tokens.css, typography.css
├── 02-基础与通用组件设计规范.md                   # 对应 src/react-app/styles/components.css, components/
├── 03-弹窗与对话框设计规范.md                     # 对应 src/react-app/components/*Modal.tsx, *Dialog.tsx
├── 04-核心业务模块设计规范.md                     # 对应 src/react-app/products/, download/, appointment/, trainingcenter/, forms/, admin/, page-agent/
└── 05-动效、响应式与可访问性规范.md               # 对应 src/react-app/index.css, styles/floating-dock.css
```

---

## 3. 核心设计原则

1. **克制与呼吸感（Restraint & Whitespace）**：
   - 避免无意义的装饰。留白不仅是背景，更是引导用户视线、组织信息密度的结构性元素。
2. **Apple 级质感与微对比（Apple Craftsmanship）**：
   - 使用柔和的高斯模糊玻璃拟态（`backdrop-filter: blur(16px)`）、多重细微阴影（Elevation Shadows）与精致的 1px 半透明边框。
3. **即时与确定性反馈（Deterministic Feedback）**：
   - 任何交互在 80ms 内必须有明确的视觉反馈（轻微微缩 `scale(0.98)`、浮起 `translateY(-2px)` 或发光）；微交互控制在 150-300ms 黄金区间。
4. **流体适应与全端一致性（Fluid Adaptability）**：
   - 采用基于 `clamp()` 的无断点跳跃流体排版，以及基于 4/8dp 节奏的弹性栅格系统，保证从 375px 手机端到 4K 宽屏的一致阅读体验。
5. **合规与无障碍先行（Compliance & Accessibility by Design）**：
   - 严格落实 GDPR、Cookie 隐私偏好、WCAG 2.1 AA 级对比度标准与全键盘 Tab 焦点可达。

---

## 4. 快速上手

### 引用设计令牌 (CSS Custom Properties)
```css
/* 在组件中直接使用设计令牌 */
.custom-card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-default);
  padding: var(--spacing-6);
  transition: all var(--transition-default) var(--ease-default);
}

.custom-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

### 编写 Tailwind 实用类
```html
<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-200">
  <h3 class="heading-3 mb-2">洲明科技 VIP 专区</h3>
  <p class="body-base text-gray-600 dark:text-gray-300">为全球客户提供专业级光显解决方案与工程配置服务。</p>
</div>
```
