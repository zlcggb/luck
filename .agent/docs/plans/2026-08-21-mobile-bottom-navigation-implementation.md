# 手机端底部导航与设置返回路径实施计划

> 日期：2026-08-21  
> 依据：`.agent/docs/specs/2026-08-21-mobile-bottom-navigation-design.md`  
> 扩展依据：`.agent/docs/specs/2026-08-21-admin-theme-checkin-display-design.md`  
> 实施方式：测试驱动开发（先红、后绿、再重构）

## 目标

在不影响轮动抽奖舞台和签到参与端业务的前提下，为已登录管理端提供“项目 / 抽奖 / 我的”三个手机端固定入口；新增只读个人信息页；补全设置抽屉返回项目列表、当前工作台和个人中心的明确路径；同时建立管理端浅色/深色全局主题并重构签到大屏。

## 边界与约束

- 仅修改前端；不新增数据库迁移，不修改 Supabase RLS/Auth 配置。
- 底部导航只在 `<640px` 显示。
- `/lottery*`、`/display`、`/checkin`、`/lottery/personal-wheel` 不渲染底部导航。
- 最近项目仅存储项目 ID，不存储姓名、邮箱或其他个人数据。
- 设置抽屉层级高于底部导航；关闭 `X` 只关闭抽屉。
- 管理界面明暗主题与抽奖舞台 `ThemeId` 相互独立。
- 签到大屏删除常驻二维码卡片，只保留顶部按钮触发的二维码弹层。
- 保留当前未提交改动，不清理或覆盖用户已有工作。

## 任务 0：管理端全局主题基础设施

**文件**

- 新建：`src/contexts/UiAppearanceContext.test.tsx`
- 新建：`src/contexts/UiAppearanceContext.tsx`
- 新建：`src/components/ui/AppearanceToggle.test.tsx`
- 新建：`src/components/ui/AppearanceToggle.tsx`
- 修改：`src/MainApp.tsx`
- 修改：`src/index.css`

### 0.1 先写失败测试

覆盖默认浅色、保存值恢复、切换、无效存储值回退、`localStorage` 异常不崩溃，以及两个切换按钮共享同一 Context 状态。

期望接口：

```ts
export type UiAppearance = 'light' | 'dark';
export const UI_APPEARANCE_STORAGE_KEY = 'luck_ui_appearance';
export function UiAppearanceProvider(props: { children: React.ReactNode }): JSX.Element;
export function useUiAppearance(): UiAppearanceContextValue;
```

执行并确认失败：

```bash
npm test -- src/contexts/UiAppearanceContext.test.tsx src/components/ui/AppearanceToggle.test.tsx
```

### 0.2 最小实现

- Provider 包裹 `MainApp` 路由。
- 页面通过 `.admin-ui[data-ui-theme="light|dark"]` 使用 CSS 变量。
- `AppearanceToggle` 根据当前状态渲染 `Sun` 或 `Moon`，并提供明确 `aria-label`。
- 管理页面逐步用变量替换硬编码表面色；抽奖舞台不挂载 `.admin-ui`，避免主题串色。

目标测试通过后执行 `npm run typecheck`。

## 任务 1：最近项目导航工具

**文件**

- 新建：`src/utils/mobileNavigation.test.ts`
- 新建：`src/utils/mobileNavigation.ts`

### 1.1 先写失败测试

覆盖以下行为：

1. 保存时去除首尾空格，读取相同项目 ID。
2. 空 ID 不覆盖已有值。
3. 指定 ID 的清理只在当前值一致时发生。
4. 不指定 ID 时无条件清理。
5. `localStorage` 抛错时函数不向外抛错。
6. 有项目时返回 `/project/:id`，无项目时返回 `/projects`。
7. 项目 ID 经过 URL 编码。

测试期望接口：

```ts
export const LAST_PROJECT_STORAGE_KEY = 'luck_last_project_id';
export function rememberLastProject(projectId: string): void;
export function getLastProjectId(): string | null;
export function clearLastProject(projectId?: string): void;
export function resolveLotteryDestination(projectId?: string | null): string;
```

执行并确认失败：

```bash
npm test -- src/utils/mobileNavigation.test.ts
```

预期：模块不存在或导出不存在，测试为红。

### 1.2 最小实现

实现原则：

```ts
const getStorage = () => (typeof window === 'undefined' ? null : window.localStorage);

export const resolveLotteryDestination = (projectId?: string | null) => {
  const normalized = projectId?.trim();
  return normalized ? `/project/${encodeURIComponent(normalized)}` : '/projects';
};
```

所有存储读写放在 `try/catch` 内；读取空字符串时返回 `null`。

再次执行：

```bash
npm test -- src/utils/mobileNavigation.test.ts
```

预期：全部通过。

## 任务 2：共享手机端底部导航

**文件**

- 新建：`src/components/navigation/MobileBottomNav.test.tsx`
- 新建：`src/components/navigation/MobileBottomNav.tsx`

### 2.1 先写失败测试

在 `MemoryRouter` 中验证：

- 恰好存在“项目”“抽奖”“我的”三个链接。
- 目标依次为 `/projects`、`/project/current-id`、`/profile`。
- `active="lottery"` 时仅“抽奖”有 `aria-current="page"`。
- 无项目 ID 时“抽奖”回退 `/projects`。
- 根节点包含 `sm:hidden`、固定定位和底部安全区标记。

执行并确认失败：

```bash
npm test -- src/components/navigation/MobileBottomNav.test.tsx
```

### 2.2 最小实现

组件接口：

```tsx
export type MobileNavSection = 'projects' | 'lottery' | 'profile';

interface MobileBottomNavProps {
  active: MobileNavSection;
  lotteryProjectId?: string | null;
}
```

组件结构：

```tsx
<nav aria-label="手机端主导航" className="vip-mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 sm:hidden">
  {/* FolderKanban / Sparkles / CircleUserRound；图标 aria-hidden */}
</nav>
```

每个链接保证 `min-h-11 min-w-11`、可见文字、品牌蓝焦点环；激活项由 `active` 唯一决定，不依赖模糊路径匹配。

执行：

```bash
npm test -- src/components/navigation/MobileBottomNav.test.tsx
```

预期：全部通过。

## 任务 3：个人资料解析与个人信息页

**文件**

- 新建：`src/utils/authProfile.test.ts`
- 新建：`src/utils/authProfile.ts`
- 新建：`src/pages/ProfilePage.test.tsx`
- 新建：`src/pages/ProfilePage.tsx`

### 3.1 先写资料解析失败测试

纯函数接口：

```ts
export function getAuthDisplayName(user: {
  email?: string | null;
  user_metadata?: { name?: unknown } | null;
}): string;

export function getAuthInitial(displayName: string): string;
```

覆盖：优先使用修剪后的 `user_metadata.name`；空姓名回退邮箱 `@` 前缀；邮箱也为空时显示“管理员”；头像首字母对中英文均稳定。

### 3.2 先写页面失败测试

mock `supabase.auth.getUser` 与 `signOut`，验证：

1. 加载完成后展示姓名、邮箱、已登录状态和本地化注册时间。
2. 姓名为空时展示邮箱前缀。
3. 获取资料失败时展示错误和“重新加载”，点击可重试。
4. 退出成功导航 `/login`。
5. 退出失败保留当前页并展示错误，不误跳转。
6. 页面包含激活“我的”的底部导航；抽奖目标使用最近项目。

执行并确认失败：

```bash
npm test -- src/utils/authProfile.test.ts src/pages/ProfilePage.test.tsx
```

### 3.3 最小实现

页面状态：

```ts
type LoadState = 'loading' | 'ready' | 'error';
const [loadState, setLoadState] = useState<LoadState>('loading');
const [user, setUser] = useState<User | null>(null);
const [error, setError] = useState('');
const [signingOut, setSigningOut] = useState(false);
```

页面采用现有 `vip-ui`、`vip-glass`、`vip-card`、`vip-button-secondary` 设计令牌，颜色限定为白/灰/品牌蓝；退出按钮使用红色文字作为次级危险操作。主内容使用 `pb-28 sm:pb-16`。

退出逻辑必须检查 Supabase 返回的 `error`：

```ts
const { error: signOutError } = await supabase.auth.signOut();
if (signOutError) throw signOutError;
navigate('/login', { replace: true });
```

再次执行目标测试并确认通过。

## 任务 4：路由与项目页面集成

**文件**

- 修改：`src/MainApp.tsx`
- 修改：`src/pages/ProjectListPage.tsx`
- 修改：`src/pages/ProjectSettingsPage.tsx`
- 新建：`src/pages/ProjectNavigation.integration.test.tsx`（或在现有页面测试中添加等价覆盖）

### 4.1 先写失败测试

覆盖以下可观察行为：

- `/profile` 位于 `RequireAuth` 保护范围内。
- 项目列表有项目时，最近项目有效则优先；无效则回退首个项目并更新存储。
- 项目列表为空时抽奖入口回到 `/projects`。
- 删除最近项目时清理旧 ID，并选择剩余第一个项目作为下一抽奖目标。
- 项目工作台加载成功后记住路由项目 ID。
- 手机端顶部操作组具有 `hidden sm:flex`；底部导航激活“抽奖”。

若直接渲染数据库页面导致 mock 成本过高，先将“从列表选择有效最近项目”的逻辑提取为纯函数并单测，再用页面测试验证组件已经调用该逻辑。

### 4.2 路由实现

在受保护路由中加入：

```tsx
<Route path="/profile" element={<ProfilePage />} />
```

### 4.3 项目列表集成

- 加载项目完成后计算 `lotteryProjectId`。
- 新建项目成功时立即 `rememberLastProject(project.id)`。
- 项目卡进入工作台前记录 ID。
- 删除项目成功后用函数式 `setProjects` 计算剩余列表，避免闭包旧值；同步清理/更新最近项目。
- 主内容改为 `pb-28 sm:pb-16`。
- 页面末尾渲染：

```tsx
<MobileBottomNav active="projects" lotteryProjectId={lotteryProjectId} />
```

### 4.4 项目工作台集成

- 项目数据成功加载后调用 `rememberLastProject(projectId)`。
- 顶部操作组从 `flex` 调整为 `hidden sm:flex`。
- 主内容改为 `pb-28 sm:pb-16`。
- 页面末尾渲染激活“抽奖”的底部导航。

执行：

```bash
npm test -- src/pages/ProjectNavigation.integration.test.tsx src/components/navigation/MobileBottomNav.test.tsx src/utils/mobileNavigation.test.ts
```

## 任务 5：设置抽屉的明确返回路径

**文件**

- 修改：`src/components/SettingsPanel.tsx`
- 新建：`src/components/SettingsPanel.navigation.test.tsx`

### 5.1 先写失败测试

对 `SettingsPanel` 做最小依赖 mock，验证：

1. 点击“项目管理”调用 `onClose` 并导航 `/projects`。
2. 点击“返回工作台”进入 `/project/:selectedProjectId`。
3. 缺少当前项目时“返回工作台”回退 `/projects`。
4. 点击账号姓名进入 `/profile`，不调用 `signOut`。
5. 点击独立“退出登录”才调用 `signOut`；成功后进入 `/login`。
6. 点击关闭按钮只调用 `onClose`，不触发路由跳转。
7. 切换项目后调用 `rememberLastProject(projectId)`。

若完整面板渲染被其现有异步依赖阻塞，将顶部/账号导航提取为同目录的轻量内部组件并独立测试；不为测试改动业务行为。

### 5.2 最小实现

新增统一导航函数，确保先关闭再跳转：

```ts
const navigateFromSettings = (destination: string) => {
  onClose();
  navigate(destination);
};
```

- 左栏标题改为语义化 `button`，目标 `/projects`。
- 标题栏增加 `ArrowLeft` + “返回工作台”。
- 返回目标使用 `resolveLotteryDestination(selectedProjectId || currentEventId)`。
- 账号信息改为独立 `button`，目标 `/profile`。
- 退出按钮添加 `aria-label="退出登录"`，检查 Supabase `error` 后再清理本地 UI 并导航 `/login`。
- `X` 添加 `aria-label="关闭设置"`，只绑定 `onClose`。
- 项目切换时同时写入现有 `luck_last_event_id`（兼容旧逻辑）和新的 `luck_last_project_id`。

执行：

```bash
npm test -- src/components/SettingsPanel.navigation.test.tsx
```

## 任务 6：签到大屏组件拆分与行为测试

**文件**

- 新建：`src/components/checkin/CheckInDisplayHeader.test.tsx`
- 新建：`src/components/checkin/CheckInDisplayHeader.tsx`
- 新建：`src/components/checkin/CheckInQrModal.test.tsx`
- 新建：`src/components/checkin/CheckInQrModal.tsx`
- 新建：`src/pages/CheckInDisplayPage.test.tsx`
- 修改：`src/pages/CheckInDisplayPage.tsx`

### 6.1 二维码弹层先写失败测试

验证：

- 顶部二维码按钮打开 `role="dialog"` 弹层。
- 页面主体不存在常驻“扫码签到”二维码卡片。
- 弹层内有活动名称、白底黑码、复制链接和打开签到页。
- 关闭按钮、点击遮罩和 `Escape` 均可关闭。
- 复制成功显示“已复制”；Clipboard API 失败显示错误。
- 签到进行中时显示剩余时间。

### 6.2 顶部栏先写失败测试

验证：

- 活动名称为唯一主标题，“签到大屏”为次级标签。
- 未开始显示品牌蓝“开始签到”。
- 进行中显示倒计时和红色描边“结束签到”。
- 刷新、声音、主题、二维码和全屏按钮都有可访问名称。
- 工具组允许响应式换行并使用统一按钮样式。

### 6.3 会话错误与确认测试

- 点击结束先展示确认，不立即请求接口。
- 取消后会话保持进行中。
- 确认成功后关闭会话并清空倒计时。
- 开始或结束接口失败时保留原状态并显示错误。
- 刷新失败保留已有签到记录。

执行并确认失败：

```bash
npm test -- src/components/checkin/CheckInDisplayHeader.test.tsx src/components/checkin/CheckInQrModal.test.tsx src/pages/CheckInDisplayPage.test.tsx
```

### 6.4 最小实现与重构

- `CheckInDisplayHeader` 只接收展示状态和回调，不访问数据库。
- `CheckInQrModal` 只负责二维码与链接操作。
- `CheckInDisplayPage` 保留 Supabase 数据加载、订阅和会话状态。
- 删除原 JSX 中第 619–665 行的常驻二维码卡片。
- 二维码弹层外围使用管理主题，二维码固定 `#fff / #000`。
- 为异步操作增加错误状态；结束签到增加确认弹层。
- 目标测试通过后再删除重复 JSX 和内联样式。

## 任务 7：签到大屏双主题布局重构

**文件**

- 修改：`src/pages/CheckInDisplayPage.tsx`
- 修改：`src/components/checkin/RealtimeFeed.tsx`
- 修改：`src/components/checkin/CheckInCard.tsx`
- 修改：`src/components/checkin/CheckInStats.tsx`
- 修改：`src/index.css`

实现内容：

- 根节点挂载 `.admin-ui` 和当前 `data-ui-theme`。
- 顶部栏改为可换行的左右布局；标题、连接状态、签到状态、时间和工具组建立清晰层级。
- 桌面右栏只保留进度、部门分布和刚刚签到，不再向下溢出二维码。
- 低于桌面断点时主体允许页面滚动并转为单列，移除导致内容被截断的组合限制。
- RealtimeFeed、CheckInCard、CheckInStats 使用主题变量替换硬编码白/黑/绿色表面色。
- 绿色只用于成功与连接状态；常规按钮统一使用品牌蓝和中性表面色。
- `prefers-reduced-motion` 下禁用弹跳、位移和缩放动画。

执行：

```bash
npm test -- src/pages/CheckInDisplayPage.test.tsx src/components/checkin/CheckInDisplayHeader.test.tsx src/components/checkin/CheckInQrModal.test.tsx
npm run typecheck
```

## 任务 8：管理页面主题接入

**文件**

- 修改：`src/pages/ProjectListPage.tsx`
- 修改：`src/pages/ProjectSettingsPage.tsx`
- 修改：`src/pages/ProfilePage.tsx`
- 修改：`src/components/SettingsPanel.tsx`
- 修改：`src/components/navigation/MobileBottomNav.tsx`

- 所有管理页面根节点挂载 `.admin-ui`。
- 设置抽屉标题栏加入 `AppearanceToggle`，与签到大屏共享 Context。
- 项目列表、项目工作台、个人信息和底部导航使用管理主题变量。
- 保证设置抽屉覆盖开奖舞台时，主题只作用于抽屉自身。
- 增加集成测试：从设置抽屉切换主题后，同一 Provider 下的页面状态同步。

## 任务 9：安全区样式与响应式细节

**文件**

- 修改：`src/index.css`
- 必要时修改：`src/pages/ProjectListPage.tsx`
- 必要时修改：`src/pages/ProjectSettingsPage.tsx`
- 必要时修改：`src/pages/ProfilePage.tsx`

新增样式：

```css
.vip-mobile-bottom-nav {
  min-height: calc(4rem + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
```

在 `prefers-reduced-motion: reduce` 中禁用导航链接位移/缩放动画。检查输入区和最后一张卡片不被底栏遮挡。

## 任务 10：全量验证与浏览器验收

### 7.1 自动化验证

按顺序执行：

```bash
npm test
npm run test:coverage
npm run typecheck
npm run build
npm audit --audit-level=high
```

验收：

- 所有测试通过。
- 新增工具、导航组件、个人信息页分支均被测试覆盖；总覆盖率不低于当前阈值且新增代码达到 80% 以上。
- TypeScript 无错误，Vite 生产构建成功。
- `npm audit` 只报告，不自动执行破坏性升级；若存在既有漏洞，在交付中单独说明。

### 7.2 浏览器验收

使用本地运行中的应用逐项检查：

1. `375×812`：项目、工作台、个人信息三页的底栏可见且不遮挡内容。
2. `768×1024`、`1440×900`：底栏隐藏，桌面顶部导航无回归。
3. 项目 → 抽奖 → 我的连续切换，浏览器返回顺序正确。
4. 删除最近项目后，抽奖入口不会进入失效项目。
5. 工作台手机顶部不再显示设置/大屏/签到按钮，操作卡仍可用。
6. 轮动舞台、签到页、签到大屏、个人转盘均不出现管理底栏。
7. 从抽奖舞台打开设置抽屉：项目管理、返回工作台、个人中心、退出登录、关闭 `X` 五条路径各自正确。
8. 键盘 Tab 可聚焦三个底栏入口及设置抽屉新增入口，焦点环清晰。
9. 1440×900 下签到大屏不再显示底部二维码卡片，右栏内容完整可见。
10. 1024×768 下顶部控制可换行且不重叠；浅色和深色下二维码都可扫描。
11. 签到大屏切为深色后打开设置抽屉，主题一致；切回浅色后项目工作台同步。
12. 管理主题切换不改变轮动或转盘抽奖舞台的活动配色。

## 任务 11：提交与交付

建议按可回滚单元提交：

```text
test: 覆盖手机端导航状态
feat: 添加手机端底部导航和个人信息页
feat: 补全设置面板返回路径
test: 覆盖管理端移动导航流程
```

最终交付说明包含：修改文件、交互结果、自动化验证、浏览器验收、未处理边界和现存依赖风险。
