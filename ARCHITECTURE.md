# Luck Draw — 项目架构文档

> 企业年会/活动抽奖系统，支持签到 + 抽奖两大核心流程。

---

## 1. 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | React + TypeScript | React 18, TS 5.7 |
| 构建 | Vite | 6.x |
| 路由 | React Router | v7 |
| 样式 | TailwindCSS | v3 |
| 后端/数据库 | Supabase (PostgreSQL + Auth + Realtime) | supabase-js 2.x |
| 图标 | lucide-react | - |
| 二维码 | html5-qrcode (扫描) + qrcode.react (生成) | - |
| Excel | xlsx (SheetJS) | - |

---

## 2. 数据库连接

### Supabase 项目信息

| 项 | 值 |
|---|---|
| Project Ref | `jkxjpopqbkjpevkcncrr` |
| API URL | `https://jkxjpopqbkjpevkcncrr.supabase.co` |
| Region | 默认 |

### 环境变量 (`.env`)

```bash
VITE_SUPABASE_URL=https://jkxjpopqbkjpevkcncrr.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### 客户端初始化

位于 `src/utils/supabaseCheckin.ts`：

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

全局单例，所有模块共用同一个 `supabase` 实例。

### 功能使用

| Supabase 功能 | 用途 |
|---|---|
| **Database (PostgreSQL)** | 所有业务数据存储 |
| **Auth** | 管理员登录认证 |
| **Realtime** | 签到记录实时推送（postgres_changes） |
| **RLS** | 所有 luck_* 表均启用行级安全策略 |

---

## 3. 数据库表结构

> **重要**：该 Supabase 项目被多个应用共享。本项目**仅使用 `luck_*` 前缀的 6 张表**。
>
> 无关表（请勿修改）：`posts`, `media`, `books`, `milestones`, `profiles`, `platform_feeds`, `ctms_*`, `rtf_*`, `zlcggb_*`

### 3.1 `luck_users` — 系统用户表

> 管理员/用户账号。当前 1 条数据。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK, 默认 `gen_random_uuid()` | |
| `auth_id` | uuid | FK → `auth.users.id`, UNIQUE | Supabase Auth 关联 |
| `email` | text | UNIQUE, NOT NULL | 登录邮箱 |
| `name` | text | NOT NULL | 用户名 |
| `avatar` | text | 可空 | 头像 URL |
| `phone` | text | 可空 | 手机号 |
| `company` | text | 可空 | 所属公司 |
| `role` | text | 默认 `'user'` | `admin` / `user` |
| `created_at` | timestamptz | 默认 `now()` | |
| `updated_at` | timestamptz | 默认 `now()` | |

### 3.2 `luck_events` — 活动/项目表

> 每个活动即一个抽奖项目。当前 2 条数据。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK | |
| `name` | varchar | NOT NULL | 活动名称 |
| `description` | text | 可空 | 活动描述 |
| `event_date` | date | 默认 `CURRENT_DATE` | 活动日期 |
| `location_name` | varchar | 可空 | 地点名称 |
| `location_lat` | numeric | 可空 | 纬度 |
| `location_lng` | numeric | 可空 | 经度 |
| `location_radius` | int | 默认 `500` | 地理围栏半径（米） |
| `require_location` | bool | 默认 `false` | 是否强制位置验证 |
| `status` | varchar | 默认 `'active'` | `draft` / `active` / `completed` |
| `mode` | text | 默认 `'wheel'` | `wheel`(转盘式) / `rolling`(轮动式) |
| `owner_id` | uuid | FK → `luck_users.id` | 项目所有者 |
| `cover_image` | text | 可空 | 封面图 URL |
| `settings` | jsonb | 默认 `'{}'` | 项目自定义设置 |
| `checkin_open` | bool | 默认 `false` | 签到是否开放 |
| `checkin_start_time` | timestamptz | 可空 | 签到开始时间 |
| `checkin_end_time` | timestamptz | 可空 | 签到结束时间 |
| `checkin_duration` | int | 可空 | 签到时长（分钟） |
| `created_at` | timestamptz | 默认 `now()` | |
| `updated_at` | timestamptz | 默认 `now()` | |

### 3.3 `luck_participants` — 参与者名单表

> 通过 Excel 导入、手动添加或**签到自动同步**的员工名单。
> 有 `(event_id, employee_id)` 联合唯一约束。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK | |
| `event_id` | uuid | FK → `luck_events.id` | 所属活动 |
| `employee_id` | varchar | NOT NULL, UNIQUE(event_id, employee_id) | 工号（大写存储） |
| `name` | varchar | NOT NULL | 姓名 |
| `department` | varchar | 可空 | 部门 |
| `avatar` | varchar | 可空 | 头像（默认 DiceBear 生成） |
| `status` | varchar | 默认 `'pending'` | `pending` / `checked_in` |
| `created_at` | timestamptz | 默认 `now()` | |
| `updated_at` | timestamptz | 默认 `now()` | |

### 3.4 `luck_check_ins` — 签到记录表

> 员工扫码签到的详细记录。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK | |
| `event_id` | uuid | FK → `luck_events.id` | 所属活动 |
| `participant_id` | uuid | FK → `luck_participants.id` | 关联参与者（可空） |
| `employee_id` | varchar | NOT NULL | 工号 |
| `name` | varchar | NOT NULL | 姓名 |
| `department` | varchar | 可空 | 部门 |
| `avatar` | varchar | 可空 | 头像 |
| `check_in_time` | timestamptz | 默认 `now()` | 签到时间 |
| `location_lat` | numeric | 可空 | GPS 纬度 |
| `location_lng` | numeric | 可空 | GPS 经度 |
| `location_accuracy` | numeric | 可空 | GPS 精度（米） |
| `location_valid` | bool | 可空 | 位置是否在围栏内 |
| `device_info` | jsonb | 可空 | 设备信息 |
| `ip_address` | inet | 可空 | IP 地址 |
| `check_in_method` | varchar | 默认 `'qrcode'` | 签到方式 |
| `created_at` | timestamptz | 默认 `now()` | |

### 3.5 `luck_prizes` — 奖项配置表

> 每个活动可配置多个奖项等级。当前 4 条数据。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK | |
| `event_id` | uuid | FK → `luck_events.id` | 所属活动 |
| `name` | text | NOT NULL | 奖项名称（如"一等奖"） |
| `name_en` | text | 可空 | 英文名（双语显示） |
| `description` | text | 可空 | 奖品描述 |
| `image` | text | 可空 | 奖品图片 URL |
| `quantity` | int | 默认 `1` | 总数量 |
| `remaining` | int | 默认 `1` | 剩余数量 |
| `sort_order` | int | 默认 `0` | 排序权重 |
| `is_active` | bool | 默认 `true` | 是否启用 |
| `created_at` | timestamptz | 默认 `now()` | |
| `updated_at` | timestamptz | 默认 `now()` | |

### 3.6 `luck_winners` — 中奖记录表

> 抽奖结果 + 核销追踪。当前 1 条数据。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK | |
| `event_id` | uuid | FK → `luck_events.id` | 所属活动 |
| `prize_id` | uuid | FK → `luck_prizes.id` | 对应奖项 |
| `participant_id` | uuid | FK → `luck_participants.id` | 关联参与者（可空） |
| `employee_id` | text | NOT NULL | 工号 |
| `name` | text | NOT NULL | 姓名 |
| `department` | text | 可空 | 部门 |
| `avatar` | text | 可空 | 头像 |
| `phone` | text | 可空 | 手机号 |
| `company` | text | 可空 | 公司 |
| `redeem_code` | text | 可空 | 核销兑换码 |
| `redeemed_at` | timestamptz | 可空 | 核销时间 |
| `status` | text | 默认 `'pending'` | `pending`(待核销) / `redeemed`(已核销) |
| `extra_info` | jsonb | 默认 `'{}'` | 额外表单（email/wechat/job_title 等） |
| `won_at` | timestamptz | 默认 `now()` | 中奖时间 |
| `created_at` | timestamptz | 默认 `now()` | |

### 表关系图

```
luck_users
  └── 1:N → luck_events (owner_id)

luck_events
  ├── 1:N → luck_participants (event_id)
  ├── 1:N → luck_check_ins (event_id)
  ├── 1:N → luck_prizes (event_id)
  └── 1:N → luck_winners (event_id)

luck_participants
  ├── 1:N → luck_check_ins (participant_id)
  └── 1:N → luck_winners (participant_id)

luck_prizes
  └── 1:N → luck_winners (prize_id)
```

---

## 4. 项目结构

```
luck/
├── .env                          # 环境变量（Supabase 连接信息）
├── index.html                    # 入口 HTML
├── package.json                  # 依赖管理
├── vite.config.ts                # Vite 构建配置
├── tailwind.config.js            # TailwindCSS 配置
├── tsconfig.json                 # TypeScript 配置
├── ARCHITECTURE.md               # 本文档
├── CHECKIN_SYSTEM_GUIDE.md       # 签到系统操作指南
│
├── src/
│   ├── main.tsx                  # 应用入口（挂载 React）
│   ├── MainApp.tsx               # 路由定义（13 条路由）
│   ├── App.tsx                   # 轮动式抽奖主页面（67KB）
│   ├── index.css                 # 全局样式
│   ├── types.ts                  # 前端类型定义（Participant/Prize/DrawRecord）
│   ├── theme.ts                  # 主题配置（7 个内置主题）
│   ├── avatarTheme.ts            # 头像主题配置（12 种风格）
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx             # 管理员登录
│   │   ├── ProjectListPage.tsx       # 项目列表管理
│   │   ├── ProjectSettingsPage.tsx   # 项目设置页
│   │   ├── LotteryGuidePage.tsx      # 入口引导页
│   │   ├── TurntableLotteryPage.tsx  # 转盘抽奖页面（98KB，最大文件）
│   │   ├── PersonalWheelPage.tsx     # 个人扫码转盘（员工端）
│   │   ├── CheckInPage.tsx           # 手机签到页
│   │   └── CheckInDisplayPage.tsx    # 签到大屏展示
│   │
│   ├── components/
│   │   ├── SettingsPanel.tsx     # 设置面板（91KB）
│   │   ├── Modal.tsx             # 通用模态框
│   │   └── checkin/              # 签到相关组件
│   │
│   ├── contexts/
│   │   └── ModalContext.tsx      # 全局 Modal 上下文
│   │
│   ├── hooks/
│   │   └── useModal.tsx          # Modal hook
│   │
│   ├── utils/
│   │   ├── supabaseCheckin.ts    # Supabase API 层（核心，30KB）
│   │   ├── storage.ts            # LocalStorage 工具
│   │   ├── checkinStorage.ts     # 签到缓存管理
│   │   ├── projectSettings.ts   # 项目设置持久化
│   │   ├── excel.ts             # Excel 导入导出
│   │   └── layoutAlgorithm.ts   # 布局算法
│   │
│   └── types/
│       └── checkin.ts            # 签到相关类型
│
├── sql/                          # SQL 迁移/建表脚本
├── docs/                         # 其他文档
├── public/                       # 静态资源
└── dist/                         # 构建产物
```

---

## 5. 路由设计

| 路径 | 页面文件 | 角色 | 说明 |
|---|---|---|---|
| `/` | `LotteryGuidePage` | 公开 | 入口引导页 |
| `/login` | `LoginPage` | 公开 | 管理员登录 |
| `/projects` | `ProjectListPage` | 管理员 | 项目列表 |
| `/project/:projectId` | `ProjectSettingsPage` | 管理员 | 项目设置 |
| `/lottery` | `App` (via wrapper) | 管理员 | 轮动式抽奖大屏 |
| `/lottery/rolling` | `App` (via wrapper) | 管理员 | 同上 |
| `/lottery/wheel` | `TurntableLotteryPage` | 员工 | 转盘抽奖（用户端） |
| `/lottery/wheel/admin` | `TurntableLotteryPage` | 管理员 | 转盘管理后台 |
| `/lottery/employee` | `CheckInPage` | 员工 | 工号入口 |
| `/lottery/personal-wheel` | `PersonalWheelPage` | 员工 | 个人扫码转盘 |
| `/display` | `CheckInDisplayPage` | 管理员 | 签到大屏 |
| `/checkin` | `CheckInPage` | 员工 | 手机扫码签到 |

---

## 6. 核心业务流程

### 抽奖流程

```
管理员创建项目 → 配置奖项 → 开启签到
                                     ↓
       员工扫码签到 → 自动同步到 luck_participants（抽奖池）
                                     ↓
       转盘模式: 即时进入转盘抽奖
       轮动模式: 等待管理员开奖
                                     ↓
       中奖者领奖 → 核销兑换码 → 完成
```

> **签到→抽奖池自动同步机制**：`checkIn()` 函数在写入 `luck_check_ins` 后，
> 自动 upsert 到 `luck_participants`（status='checked_in'），
> 使签到者立即成为抽奖池成员，无需手动导入。

### 两种抽奖模式

- **转盘式 (wheel)**：大转盘动画，适合现场互动，支持个人扫码参与
- **轮动式 (rolling)**：名单滚动停止，适合大屏展示，传统年会风格

### 签到机制

- 支持 **QR码扫描** 和 **手动输入工号**
- 可选 **地理围栏验证**（GPS 检查是否在活动范围内）
- **Realtime 订阅**：签到大屏自动刷新（基于 Supabase postgres_changes）

### 活动关联策略（免登录）

优先级从高到低：
1. 登录用户 → 使用 `owner_id` 关联的项目
2. URL 参数 → `?event=<uuid>` 指定
3. 浏览器缓存 → `localStorage` 的 `luck_last_event_id`
4. 全局活动 → 数据库中 `status='active'` 的活动

---

## 7. API 层概览

所有 Supabase 操作集中在 `src/utils/supabaseCheckin.ts`，导出以下 API：

| 分类 | 函数 | 说明 |
|---|---|---|
| **活动** | `getEvent`, `getActiveEvent` | 获取活动 |
| | `createEvent`, `updateEvent` | 管理活动 |
| | `createProject`, `updateProject`, `deleteProject` | 项目 CRUD |
| | `getUserProjects` | 获取用户项目列表 |
| **签到** | `checkIn` | 执行签到 |
| | `getCheckInByEmployee` | 查询员工签到状态 |
| | `getCheckInRecords`, `getCheckInCount` | 签到记录/统计 |
| | `clearCheckInRecordsForEvent` | 清空签到记录 |
| | `subscribeToCheckIns` | Realtime 实时订阅 |
| **签到会话** | `startCheckInSession`, `endCheckInSession` | 开始/结束签到 |
| | `getCheckInSessionStatus`, `isCheckInOpen` | 查询签到状态 |
| **参与者** | `getParticipants`, `findParticipant` | 查询参与者 |
| | `getCheckedInParticipants` | 获取已签到参与者（抽奖池） |
| | `importParticipants`, `addParticipant` | 导入/添加 |
| | `getParticipantCount` | 统计人数 |
| **用户** | `getCurrentUser`, `getOrCreateUser` | 用户认证 |
| **奖项** | `getPrizes` | 获取奖项列表 |
| **中奖** | `wheelDraw`, `createWinner` | 转盘抽奖/创建中奖记录 |
| | `redeemWinner`, `redeemByCode`, `lookupByCode` | 核销 |
| | `checkPhoneDuplicate` | 手机号查重 |

---

## 8. 开发命令

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 构建生产包
npm run build

# 预览生产构建
npm run preview
```
