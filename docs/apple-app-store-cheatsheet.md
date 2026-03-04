# Apple App Store 设计速查手册

> 从 apps.apple.com 源码提炼的实战经验

---

## 🎯 快速参考

### 技术栈

```
Svelte + TypeScript + SCSS + CSS Variables
```

### 核心模式

| 模式 | 用途 | 文件示例 |
|------|------|---------|
| Intent-Action | 路由与导航 | `jet/jet.ts` |
| Type Guard | 组件类型判断 | `components/jet/shelf/*.svelte` |
| Context Injection | 跨组件状态 | `context/*.ts` |
| CSS Variables | 设计令牌 | 全局样式 |

---

## 📁 代码片段收藏

### 1. 类型守卫 + 组件导出模式

```svelte
<script lang="ts" context="module">
    import type { Shelf } from '@jet-app/app-store/api/models';

    // 1. 定义接口
    export interface MyShelf extends Shelf {
        contentType: 'myType';
        items: MyItem[];
    }

    // 2. 类型守卫
    export function isMyShelf(shelf: Shelf): shelf is MyShelf {
        return shelf.contentType === 'myType' && Array.isArray(shelf.items);
    }
</script>

<script lang="ts">
    // 3. 使用类型
    export let shelf: MyShelf;
</script>
```

### 2. 响应式断点系统

```scss
// 媒体查询断点
@media (--range-xsmall-down)   { /* 移动端 */ }
@media (--range-small-up)      { /* 平板+ */ }
@media (--range-medium-up)     { /* 桌面+ */ }
@media (--range-xlarge-up)     { /* 大屏 */ }

// 容器查询
.container {
    container-type: inline-size;
    container-name: my-container;
}

@container my-container (max-width: 500px) {
    .child { font-size: 14px; }
}
```

### 3. CSS 变量设计令牌

```scss
:root {
    // 颜色
    --systemPrimary: #1d1d1f;
    --systemSecondary: #86868b;
    --keyColor: #0071e3;
    
    // 排版
    --large-title-emphasized: 600 34px/1.1 SF Pro Display;
    --body: 400 17px/1.47 SF Pro Text;
    
    // 间距
    --bodyGutter: 25px;
    
    // 暗色模式
    @media (prefers-color-scheme: dark) {
        --systemPrimary: #f5f5f7;
        --systemSecondary: #a1a1a6;
    }
}
```

### 4. 优雅的渐变遮罩

```scss
.gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        55deg,
        rgb(from var(--bg-color) r g b / 0.25) 0%,
        transparent 50%
    );
    filter: saturate(1.5) brightness(0.9);
    backdrop-filter: blur(40px);
    mask-image: radial-gradient(
        ellipse 127% 130% at 5% 100%,
        #000 18%,
        rgba(0,0,0,0.33) 24%,
        rgba(0,0,0,0.66) 32%,
        transparent 40%
    );
}
```

### 5. RTL 支持

```scss
// 使用逻辑属性
.element {
    padding-inline-start: 40px;  // 替代 padding-left
    margin-inline-end: 20px;     // 替代 margin-right
    inset-inline-end: 0;         // 替代 right
}

// RTL 特殊处理
.element {
    &:dir(rtl) {
        transform: scaleX(-1);
    }
}
```

### 6. 渐进动画

```typescript
const BASE_DELAY = 80;
const BASE_DURATION = 150;
const DURATION_SPREAD = 300;

function getEasedDuration(i: number, total: number, easing = circOut) {
    const t = i / (total - 1);
    return BASE_DURATION + easing(t) * DURATION_SPREAD;
}

// 列表动画
{#each items as item, i}
    <li in:fly={{ delay: i * BASE_DELAY, duration: getEasedDuration(i, items.length) }}>
        ...
    </li>
{/each}
```

### 7. 延迟加载提示

```typescript
async function loadWithDelay<T>(promise: Promise<T>, delayMs = 500) {
    await Promise.race([
        promise,
        new Promise(r => setTimeout(r, delayMs))
    ]).catch(() => {});
    
    return { promise };
}

// 使用
const result = await loadWithDelay(fetchData());
// 500ms 后如果还没完成，才显示 loading
```

### 8. Svelte Store 工厂

```typescript
import { readable, writable } from 'svelte/store';
import { getContext, setContext } from 'svelte';

const CONTEXT_KEY = 'my-store';

// 创建并注入
export function createMyStore(initialValue) {
    const store = writable(initialValue);
    setContext(CONTEXT_KEY, store);
    return store;
}

// 获取
export function getMyStore() {
    return getContext(CONTEXT_KEY);
}
```

### 9. WeakMap Context 模式

```typescript
type Store = WeakMap<SomeType, SomeConfig>;

export function setLayoutContext(items: SomeType[]) {
    const store: Store = new WeakMap();
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const next = items[i + 1];
        store.set(item, { needsPadding: !next });
    }
    
    setContext('layout', store);
}

export function getLayoutConfig(item: SomeType) {
    return getContext<Store>('layout')?.get(item) ?? DEFAULT;
}
```

### 10. 无障碍支持

```scss
// Reduced Motion
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}

// 智能反色
@media (inverted-colors: inverted) {
    img {
        filter: invert(1);
    }
}
```

---

## 🏗️ 架构模式图解

### Jet Framework 流程

```
用户点击 ──▶ FlowAction ──▶ Intent ──▶ Controller ──▶ Page ──▶ Render
     │            │            │            │           │
     │            │            │            │           └── Svelte 组件
     │            │            │            └── 业务逻辑处理
     │            │            └── 导航目的地描述
     │            └── 用户交互封装
     └── 交互事件
```

### Shelf 组件分发

```
Shelf.svelte (路由器)
    │
    ├─ isHeroShelf(shelf) ─────▶ HeroShelf
    ├─ isCardShelf(shelf) ─────▶ CardShelf
    ├─ isListShelf(shelf) ─────▶ ListShelf
    └─ fallback ───────────────▶ FallbackShelf
```

---

## 💡 设计原则速记

1. **500ms 规则** - 超过 500ms 才显示 loading
2. **类型收窄** - 每个组件导出自己的类型守卫
3. **逻辑属性** - 用 inline/block 替代 left/right/top/bottom
4. **容器查询** - 组件级响应式优于视口级
5. **WeakMap Context** - 避免内存泄漏的跨组件状态
6. **渐进动画** - 列表项动画时长随位置递增

---

## 📚 文件路径速查

| 功能 | 路径 |
|------|------|
| 应用入口 | `src/App.svelte` |
| 启动引导 | `src/bootstrap.ts` |
| 路由核心 | `src/jet/jet.ts` |
| 动作处理 | `src/jet/action-handlers/` |
| 页面组件 | `src/components/pages/` |
| Shelf 组件 | `src/components/jet/shelf/` |
| 工具函数 | `src/utils/` |
| 状态管理 | `src/stores/` |
| Context | `src/context/` |
| 国际化 | `shared/localization/` |
| SF Symbols | `src/sf-symbols/` |

---

*提取自 apps.apple.com 前端源码 · 仅供学习参考*
