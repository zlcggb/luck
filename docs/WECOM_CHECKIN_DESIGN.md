# 企业微信扫码签到系统设计文档

> 版本: 1.0.0  
> 日期: 2026-01-23  
> 作者: AI Assistant

---

## 目录

1. [系统概述](#1-系统概述)
2. [核心功能](#2-核心功能)
3. [企业微信配置指南](#3-企业微信配置指南)
4. [技术架构](#4-技术架构)
5. [数据库设计](#5-数据库设计)
6. [API 设计](#6-api-设计)
7. [权限设计](#7-权限设计)
8. [前端页面设计](#8-前端页面设计)
9. [部署清单](#9-部署清单)

---

## 1. 系统概述

### 1.1 业务背景

本系统为年会/活动抽奖系统的签到模块，通过企业微信扫码实现：

- 员工身份验证（工号 + 姓名）
- 现场签到（含地理位置记录）
- 签到数据与抽奖系统联动

### 1.2 核心目标

| 目标     | 描述                                 |
| -------- | ------------------------------------ |
| 身份验证 | 确保签到人员为企业微信认证员工       |
| 数据准确 | 工号、姓名来自企业微信，无需手动输入 |
| 位置记录 | 可选功能，记录签到时的地理位置       |
| 实时展示 | 大屏动态展示签到人员                 |

---

## 2. 核心功能

### 2.1 功能清单

```
┌─────────────────────────────────────────────────────────────────┐
│                        签到系统功能模块                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📱 扫码签到                                                      │
│  ├── 企业微信扫码授权                                             │
│  ├── 获取员工信息（工号 + 姓名）                                   │
│  ├── 获取地理位置（可选）                                         │
│  └── 提交签到记录                                                 │
│                                                                   │
│  📺 大屏展示                                                      │
│  ├── 实时签到动态                                                 │
│  ├── 签到统计数据                                                 │
│  ├── 最新签到用户展示                                             │
│  └── 签到进度可视化                                               │
│                                                                   │
│  🎯 签到管理                                                      │
│  ├── 签到名单导入                                                 │
│  ├── 签到状态查询                                                 │
│  ├── 手动签到（备用）                                             │
│  └── 签到数据导出                                                 │
│                                                                   │
│  🔗 抽奖联动                                                      │
│  ├── 仅已签到人员可参与抽奖                                       │
│  └── 签到数据同步至抽奖池                                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 用户角色

| 角色       | 权限                             |
| ---------- | -------------------------------- |
| 普通员工   | 扫码签到                         |
| 活动管理员 | 管理签到名单、查看统计、手动签到 |
| 大屏展示   | 仅展示签到动态（只读）           |

---

## 3. 企业微信配置指南

### 3.1 前置条件

- [x] 拥有企业微信管理员权限
- [x] 企业已完成企业微信认证（可选但推荐）
- [x] 准备一个可公网访问的域名（用于 OAuth 回调）

### 3.2 创建自建应用

#### 步骤 1：登录企业微信管理后台

访问 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)

#### 步骤 2：创建应用

```
路径：应用管理 → 应用 → 自建 → 创建应用
```

填写信息：
| 字段 | 示例值 | 说明 |
|------|--------|------|
| 应用名称 | 年会签到系统 | 用户可见 |
| 应用 Logo | 上传图片 | 建议 200x200 |
| 可见范围 | 选择部门/人员 | 可访问该应用的员工范围 |

#### 步骤 3：获取关键参数

创建成功后，记录以下信息：

| 参数         | 位置                | 用途                     |
| ------------ | ------------------- | ------------------------ |
| `corpid`     | 企业信息 → 企业ID   | 企业唯一标识             |
| `agentid`    | 应用详情页          | 应用唯一标识             |
| `corpsecret` | 应用详情页 → Secret | 应用凭证密钥（点击查看） |

⚠️ **安全提示**：`corpsecret` 请妥善保管，不要暴露在前端代码中！

#### 步骤 4：配置 OAuth 可信域名

```
路径：应用详情 → 企业微信授权登录 → 设置授权回调域
```

配置内容：
| 配置项 | 值 |
|--------|-----|
| 授权回调域 | `your-domain.com` (不含 http/https 协议头) |

例如您的系统部署在 `https://luck.example.com`，则填写 `luck.example.com`

#### 步骤 5：配置可信 IP

```
路径：应用详情 → 企业可信IP
```

添加您服务器的出口 IP 地址，用于调用企业微信 API。

### 3.3 配置扫码登录

#### 步骤 1：开启扫码登录

```
路径：应用详情 → 企业微信授权登录 → Web网页 → 开启
```

#### 步骤 2：配置回调域名

确保回调域名与上述可信域名一致。

### 3.4 获取敏感信息权限

自 2022 年 6 月起，获取员工姓名等敏感信息需要用户手动授权：

```
路径：应用详情 → 开发者接口 → 敏感接口权限申请
```

申请以下权限：

- `auth/getuserdetail` - 获取访问用户敏感信息

---

## 4. 技术架构

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          系统架构图                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────────┐    │
│   │  员工手机端    │    │  大屏展示端    │    │  管理端 (Settings) │    │
│   │  (扫码签到)    │    │  (实时动态)    │    │  (签到管理)        │    │
│   └───────┬───────┘    └───────┬───────┘    └─────────┬─────────┘    │
│           │                    │                      │              │
│           └────────────────────┼──────────────────────┘              │
│                                │                                      │
│                                ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │                     React 前端应用                           │    │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │    │
│   │  │ CheckInPage │  │ DisplayPage │  │ CheckInSettingsPanel│  │    │
│   │  │ (签到页面)   │  │ (大屏页面)   │  │ (签到设置)          │  │    │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘  │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                │                                      │
│                                ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │              Supabase Edge Function (后端)                   │    │
│   │  ┌─────────────────┐  ┌─────────────────────────────────┐   │    │
│   │  │ wecom-oauth     │  │ checkin-api                     │   │    │
│   │  │ (企业微信认证)   │  │ (签到接口)                       │   │    │
│   │  └─────────────────┘  └─────────────────────────────────┘   │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                │                                      │
│                                ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │                     企业微信 API                             │    │
│   │  • gettoken (获取 access_token)                             │    │
│   │  • getuserinfo (获取用户身份)                                │    │
│   │  • getuserdetail (获取用户敏感信息)                          │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 OAuth 认证流程

```
┌──────────────────────────────────────────────────────────────────────┐
│                    企业微信 OAuth2.0 扫码认证流程                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────┐                                                           │
│  │ 1. 前端 │ 生成授权URL，展示二维码                                    │
│  └────┬────┘                                                           │
│       │  授权URL格式：                                                  │
│       │  https://open.work.weixin.qq.com/wwopen/sso/qrConnect          │
│       │  ?appid=CORPID                                                 │
│       │  &agentid=AGENTID                                              │
│       │  &redirect_uri=CALLBACK_URL                                    │
│       │  &state=STATE                                                  │
│       ▼                                                                │
│  ┌─────────┐                                                           │
│  │ 2. 用户 │ 使用企业微信扫描二维码                                      │
│  └────┬────┘                                                           │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────┐                                                           │
│  │ 3. 企微 │ 用户确认授权后，重定向到回调URL                             │
│  └────┬────┘  redirect_uri?code=CODE&state=STATE                       │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────┐                                                           │
│  │ 4. 前端 │ 获取 code 参数，发送给后端                                  │
│  └────┬────┘                                                           │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────┐  调用: /cgi-bin/gettoken                                  │
│  │ 5. 后端 │  获取: access_token                                        │
│  └────┬────┘                                                           │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────┐  调用: /cgi-bin/auth/getuserinfo?code=CODE                │
│  │ 6. 后端 │  获取: UserId + user_ticket                                │
│  └────┬────┘                                                           │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────┐  调用: /cgi-bin/auth/getuserdetail (POST user_ticket)     │
│  │ 7. 后端 │  获取: userid(工号), name(姓名), avatar...                 │
│  └────┬────┘                                                           │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────┐                                                           │
│  │ 8. 前端 │ 获取员工信息，获取地理位置，完成签到                          │
│  └─────────┘                                                           │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 技术栈

| 层级     | 技术                          | 说明            |
| -------- | ----------------------------- | --------------- |
| 前端     | React + TypeScript + Vite     | 现有技术栈      |
| 后端     | Supabase Edge Function (Deno) | Serverless 函数 |
| 数据库   | Supabase PostgreSQL           | 云数据库        |
| 实时通信 | Supabase Realtime             | 大屏实时更新    |
| 认证     | 企业微信 OAuth2.0             | 身份验证        |

---

## 5. 数据库设计

### 5.1 ER 图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          数据库 ER 图                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌────────────────────────┐       ┌────────────────────────┐        │
│   │      events            │       │      participants      │        │
│   │ (活动/场次表)           │       │ (参与者名单表)          │        │
│   ├────────────────────────┤       ├────────────────────────┤        │
│   │ id (PK)                │       │ id (PK)                │        │
│   │ name                   │       │ event_id (FK)          │        │
│   │ description            │◄──────│ employee_id            │        │
│   │ event_date             │  1:N  │ name                   │        │
│   │ location_name          │       │ department             │        │
│   │ location_lat           │       │ avatar                 │        │
│   │ location_lng           │       │ status                 │        │
│   │ location_radius        │       │ created_at             │        │
│   │ require_location       │       └───────────┬────────────┘        │
│   │ status                 │                   │                     │
│   │ created_at             │                   │ 1:1                 │
│   │ created_by             │                   │                     │
│   └────────────────────────┘                   ▼                     │
│                                    ┌────────────────────────┐        │
│                                    │     check_ins          │        │
│                                    │ (签到记录表)            │        │
│                                    ├────────────────────────┤        │
│                                    │ id (PK)                │        │
│                                    │ participant_id (FK)    │        │
│                                    │ event_id (FK)          │        │
│                                    │ employee_id            │        │
│                                    │ name                   │        │
│                                    │ department             │        │
│                                    │ avatar                 │        │
│                                    │ check_in_time          │        │
│                                    │ location_lat           │        │
│                                    │ location_lng           │        │
│                                    │ location_valid         │        │
│                                    │ device_info            │        │
│                                    │ ip_address             │        │
│                                    │ created_at             │        │
│                                    └────────────────────────┘        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 表结构详细设计

#### 5.2.1 events（活动/场次表）

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,                      -- 活动名称
  description TEXT,                                -- 活动描述
  event_date DATE NOT NULL,                        -- 活动日期
  event_time_start TIME,                           -- 开始时间
  event_time_end TIME,                             -- 结束时间

  -- 位置设置
  location_name VARCHAR(200),                      -- 位置名称 (如: 公司A栋报告厅)
  location_lat DECIMAL(10, 8),                     -- 纬度
  location_lng DECIMAL(11, 8),                     -- 经度
  location_radius INTEGER DEFAULT 500,             -- 有效签到半径(米)
  require_location BOOLEAN DEFAULT false,          -- 是否强制定位

  -- 状态
  status VARCHAR(20) DEFAULT 'draft',              -- draft/active/completed
  total_participants INTEGER DEFAULT 0,            -- 预计参与人数

  -- 审计
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,                                 -- 创建人

  CONSTRAINT events_status_check CHECK (status IN ('draft', 'active', 'completed'))
);

-- 索引
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date);
```

#### 5.2.2 participants（参与者名单表）

```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- 员工信息
  employee_id VARCHAR(100) NOT NULL,               -- 工号 (企业微信 UserId)
  name VARCHAR(100) NOT NULL,                      -- 姓名
  department VARCHAR(200),                         -- 部门
  avatar VARCHAR(500),                             -- 头像URL
  mobile VARCHAR(20),                              -- 手机号 (可选，敏感数据)
  email VARCHAR(200),                              -- 邮箱 (可选)

  -- 签到状态
  status VARCHAR(20) DEFAULT 'pending',            -- pending/checked_in
  check_in_id UUID,                                -- 关联的签到记录

  -- 来源
  source VARCHAR(20) DEFAULT 'import',             -- import/manual/sync

  -- 审计
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  UNIQUE(event_id, employee_id),                   -- 同一活动中员工唯一
  CONSTRAINT participants_status_check CHECK (status IN ('pending', 'checked_in'))
);

-- 索引
CREATE INDEX idx_participants_event ON participants(event_id);
CREATE INDEX idx_participants_employee ON participants(employee_id);
CREATE INDEX idx_participants_status ON participants(status);
```

#### 5.2.3 check_ins（签到记录表）

```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,

  -- 员工信息 (来自企业微信)
  employee_id VARCHAR(100) NOT NULL,               -- 工号 (企业微信 UserId)
  name VARCHAR(100) NOT NULL,                      -- 姓名
  department VARCHAR(200),                         -- 部门
  avatar VARCHAR(500),                             -- 头像URL

  -- 签到时间
  check_in_time TIMESTAMPTZ DEFAULT NOW(),         -- 签到时间

  -- 位置信息
  location_lat DECIMAL(10, 8),                     -- 纬度
  location_lng DECIMAL(11, 8),                     -- 经度
  location_accuracy DECIMAL(10, 2),                -- 定位精度(米)
  location_valid BOOLEAN,                          -- 是否在有效范围内
  location_distance DECIMAL(10, 2),                -- 距离活动地点(米)

  -- 设备信息
  device_info JSONB,                               -- 设备信息 (UA, 平台等)
  ip_address INET,                                 -- IP地址

  -- 签到方式
  check_in_method VARCHAR(20) DEFAULT 'qrcode',    -- qrcode/manual

  -- 审计
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：同一活动同一员工只能签到一次
  UNIQUE(event_id, employee_id)
);

-- 索引
CREATE INDEX idx_check_ins_event ON check_ins(event_id);
CREATE INDEX idx_check_ins_employee ON check_ins(employee_id);
CREATE INDEX idx_check_ins_time ON check_ins(check_in_time);

-- 实时订阅用索引
CREATE INDEX idx_check_ins_created ON check_ins(created_at DESC);
```

### 5.3 视图设计

#### 5.3.1 签到统计视图

```sql
CREATE VIEW event_check_in_stats AS
SELECT
  e.id AS event_id,
  e.name AS event_name,
  e.event_date,
  e.status,
  COUNT(DISTINCT p.id) AS total_participants,
  COUNT(DISTINCT c.id) AS checked_in_count,
  ROUND(
    COUNT(DISTINCT c.id)::DECIMAL / NULLIF(COUNT(DISTINCT p.id), 0) * 100,
    2
  ) AS check_in_percentage,
  MAX(c.check_in_time) AS last_check_in_time
FROM events e
LEFT JOIN participants p ON p.event_id = e.id
LEFT JOIN check_ins c ON c.event_id = e.id
GROUP BY e.id, e.name, e.event_date, e.status;
```

---

## 6. API 设计

### 6.1 API 端点列表

| 端点                | 方法 | 描述            | 认证   |
| ------------------- | ---- | --------------- | ------ |
| `/wecom/qrcode-url` | GET  | 生成扫码登录URL | -      |
| `/wecom/callback`   | GET  | OAuth回调处理   | -      |
| `/wecom/user-info`  | POST | 获取用户信息    | -      |
| `/check-in`         | POST | 提交签到        | 需验证 |
| `/check-in/status`  | GET  | 查询签到状态    | -      |
| `/events/:id/stats` | GET  | 获取活动统计    | 管理员 |

### 6.2 API 详细设计

#### 6.2.1 生成扫码URL

```
GET /api/wecom/qrcode-url?event_id={event_id}&redirect_uri={uri}
```

Response:

```json
{
  "success": true,
  "data": {
    "qrcode_url": "https://open.work.weixin.qq.com/wwopen/sso/qrConnect?...",
    "state": "random_state_string"
  }
}
```

#### 6.2.2 OAuth回调

```
GET /api/wecom/callback?code={code}&state={state}
```

Response: 302 重定向到前端页面，URL参数携带临时令牌

#### 6.2.3 获取用户信息

```
POST /api/wecom/user-info
Content-Type: application/json

{
  "code": "oauth_code",
  "state": "state_string"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "employee_id": "zhangsan",
    "name": "张三",
    "department": "技术研发中心",
    "avatar": "https://...",
    "gender": "1"
  }
}
```

#### 6.2.4 提交签到

```
POST /api/check-in
Content-Type: application/json

{
  "event_id": "uuid-xxx",
  "employee_id": "zhangsan",
  "name": "张三",
  "department": "技术研发中心",
  "avatar": "https://...",
  "location": {
    "latitude": 22.5431,
    "longitude": 114.0579,
    "accuracy": 65
  },
  "device_info": {
    "platform": "iOS",
    "browser": "WeCom"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "check_in_id": "uuid-xxx",
    "check_in_time": "2026-01-23T15:30:00Z",
    "location_valid": true,
    "message": "签到成功！"
  }
}
```

---

## 7. 权限设计

### 7.1 Row Level Security (RLS) 策略

#### 7.1.1 events 表权限

```sql
-- 启用 RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 所有人可读取活动信息
CREATE POLICY "events_select_all" ON events
  FOR SELECT USING (true);

-- 仅管理员可创建/修改活动
CREATE POLICY "events_insert_admin" ON events
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "events_update_admin" ON events
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'admin'
  );
```

#### 7.1.2 participants 表权限

```sql
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- 所有人可读取参与者列表（用于展示）
CREATE POLICY "participants_select_all" ON participants
  FOR SELECT USING (true);

-- 仅管理员可管理参与者
CREATE POLICY "participants_insert_admin" ON participants
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "participants_update_admin" ON participants
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'admin'
  );
```

#### 7.1.3 check_ins 表权限

```sql
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- 所有人可读取签到记录（用于大屏展示）
CREATE POLICY "check_ins_select_all" ON check_ins
  FOR SELECT USING (true);

-- 允许通过 Edge Function 插入（使用 service_role）
CREATE POLICY "check_ins_insert_service" ON check_ins
  FOR INSERT WITH CHECK (true);
```

### 7.2 角色权限矩阵

| 操作           | 普通员工 | 管理员 | 服务端 (Edge Function) |
| -------------- | :------: | :----: | :--------------------: |
| 查看活动信息   |    ✅    |   ✅   |           ✅           |
| 创建活动       |    ❌    |   ✅   |           ✅           |
| 修改活动       |    ❌    |   ✅   |           ✅           |
| 查看参与者列表 |    ✅    |   ✅   |           ✅           |
| 导入参与者     |    ❌    |   ✅   |           ✅           |
| 扫码签到       |    ✅    |   ✅   |           -            |
| 查看签到记录   |    ✅    |   ✅   |           ✅           |
| 手动签到       |    ❌    |   ✅   |           ✅           |
| 查看统计数据   |    ✅    |   ✅   |           ✅           |
| 导出数据       |    ❌    |   ✅   |           ✅           |

---

## 8. 前端页面设计

### 8.1 页面结构

```
src/
├── pages/
│   ├── CheckInPage.tsx          # 扫码签到页（移动端）
│   ├── CheckInSuccessPage.tsx   # 签到成功页
│   └── CheckInDisplayPage.tsx   # 大屏展示页
├── components/
│   ├── checkin/
│   │   ├── QRCodeScanner.tsx    # 二维码扫描/生成
│   │   ├── CheckInForm.tsx      # 签到确认表单
│   │   ├── LocationPicker.tsx   # 位置获取组件
│   │   ├── CheckInCard.tsx      # 签到者卡片
│   │   ├── CheckInStats.tsx     # 签到统计
│   │   └── RealtimeFeed.tsx     # 实时动态
│   └── CheckInSettingsPanel.tsx # 签到设置面板
└── types/
    └── checkin.ts               # 签到相关类型
```

### 8.2 页面交互设计

#### 8.2.1 签到页面流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      签到页面交互流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                                                │
│  │ 访问签到页面  │                                                │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────┐   否   ┌─────────────────────┐             │
│  │ 是否企业微信内打开?│──────▶│ 显示二维码供扫描     │             │
│  └──────┬───────────┘        └──────────┬──────────┘             │
│         │ 是                            │                         │
│         ▼                               │ 扫码后自动跳转           │
│  ┌──────────────────┐                   │                         │
│  │ 发起OAuth授权     │◀─────────────────┘                         │
│  └──────┬───────────┘                                             │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────┐                                             │
│  │ 获取用户信息      │                                             │
│  │ (工号、姓名)      │                                             │
│  └──────┬───────────┘                                             │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────┐   否   ┌─────────────────────┐             │
│  │ 需要定位?         │──────▶│ 直接显示确认页面     │             │
│  └──────┬───────────┘        └──────────┬──────────┘             │
│         │ 是                            │                         │
│         ▼                               │                         │
│  ┌──────────────────┐                   │                         │
│  │ 请求位置权限      │                   │                         │
│  │ 获取GPS坐标       │                   │                         │
│  └──────┬───────────┘                   │                         │
│         │                               │                         │
│         └───────────────────────────────┤                         │
│                                         │                         │
│                                         ▼                         │
│                              ┌─────────────────────┐             │
│                              │ 显示签到确认页面     │             │
│                              │ - 姓名、工号        │             │
│                              │ - 部门、头像        │             │
│                              │ - 位置信息          │             │
│                              │ - 签到按钮          │             │
│                              └──────────┬──────────┘             │
│                                         │                         │
│                                         ▼                         │
│                              ┌─────────────────────┐             │
│                              │ 点击签到            │             │
│                              └──────────┬──────────┘             │
│                                         │                         │
│                                         ▼                         │
│                              ┌─────────────────────┐             │
│                              │ 显示签到成功动画     │             │
│                              │ + 祝福语            │             │
│                              └─────────────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 8.2.2 大屏展示页

```
┌─────────────────────────────────────────────────────────────────────┐
│                          大屏展示布局                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                        HEADER                                    │ │
│  │              🎉 年会签到 - 实时动态                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌───────────────────────────────┐  ┌─────────────────────────────┐ │
│  │                               │  │                             │ │
│  │      最新签到 (实时动态)       │  │       签到统计              │ │
│  │                               │  │                             │ │
│  │  ┌─────┐ ┌─────┐ ┌─────┐     │  │   已签到: 156 / 200        │ │
│  │  │     │ │     │ │     │     │  │                             │ │
│  │  │ 头像 │ │ 头像 │ │ 头像 │     │  │   ▓▓▓▓▓▓▓▓▓▓▓░░░ 78%     │ │
│  │  └─────┘ └─────┘ └─────┘     │  │                             │ │
│  │   张三    李四    王五        │  │   🕐 最后签到: 15:23        │ │
│  │                               │  │                             │ │
│  │  ─────────────────────────── │  │   部门分布:                 │ │
│  │                               │  │   技术部: 45 (89%)          │ │
│  │  实时签到历史 (滚动)          │  │   市场部: 32 (76%)          │ │
│  │  [时间] [姓名] [部门]         │  │   销售部: 28 (70%)          │ │
│  │  15:23  张三  技术研发中心    │  │   ...                       │ │
│  │  15:22  李四  全球市场部      │  │                             │ │
│  │  15:20  王五  综合管理部      │  │                             │ │
│  │  ...                         │  │                             │ │
│  │                               │  │                             │ │
│  └───────────────────────────────┘  └─────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     签到二维码展示区                              │ │
│  │                        [QR CODE]                                 │ │
│  │                   扫码签到，开启好运！                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. 部署清单

### 9.1 环境变量配置

```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# 企业微信 (仅在 Edge Function 中使用，不暴露给前端)
WECOM_CORPID=ww1234567890
WECOM_AGENT_ID=1000001
WECOM_SECRET=xxxxxxxxxxxxxxx

# 应用配置
VITE_APP_URL=https://luck.example.com
VITE_OAUTH_REDIRECT_URI=https://luck.example.com/checkin/callback
```

### 9.2 部署步骤清单

- [ ] **Step 1**: 创建企业微信自建应用，获取 corpid, agentid, secret
- [ ] **Step 2**: 配置企业微信可信域名和可信IP
- [ ] **Step 3**: 在 Supabase 创建数据库表
- [ ] **Step 4**: 配置 Supabase RLS 策略
- [ ] **Step 5**: 部署 Edge Function (wecom-oauth, checkin-api)
- [ ] **Step 6**: 在 Supabase 配置 Edge Function 环境变量
- [ ] **Step 7**: 部署前端应用
- [ ] **Step 8**: 配置前端环境变量
- [ ] **Step 9**: 测试完整签到流程

### 9.3 测试清单

- [ ] 企业微信扫码授权流程
- [ ] 获取员工信息正确性
- [ ] 定位功能工作正常
- [ ] 签到数据正确存储
- [ ] 大屏实时更新
- [ ] 重复签到拦截
- [ ] 错误处理和用户提示

---

## 附录

### A. 企业微信 API 参考

- [企业微信开发者文档](https://developer.work.weixin.qq.com/document/)
- [扫码授权登录](https://developer.work.weixin.qq.com/document/path/98151)
- [获取访问用户身份](https://developer.work.weixin.qq.com/document/path/98152)
- [获取访问用户敏感信息](https://developer.work.weixin.qq.com/document/path/98153)

### B. 常见问题 (FAQ)

**Q1: 如何测试企业微信扫码功能？**  
A: 需要在企业微信 APP 中打开测试页面，或使用企业微信的开发者工具。

**Q2: 敏感信息（姓名）获取失败怎么办？**  
A: 检查是否已申请并通过敏感接口权限，以及用户是否授权。

**Q3: 如何在本地开发环境测试？**  
A: 可使用 ngrok 等工具将本地服务暴露为公网地址，并配置为企业微信可信域名。

---

_文档结束_
