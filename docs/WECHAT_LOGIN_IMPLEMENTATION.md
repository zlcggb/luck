# 微信登录签到系统实施执行文档

> 版本: 1.0.0  
> 日期: 2026-01-23  
> 作者: AI Assistant

---

## 目录

1. [实施概述](#1-实施概述)
2. [Phase 1: 微信开放平台配置](#2-phase-1-微信开放平台配置)
3. [Phase 2: 数据库设计](#3-phase-2-数据库设计)
4. [Phase 3: 后端 Edge Function 开发](#4-phase-3-后端-edge-function-开发)
5. [Phase 4: 前端开发](#5-phase-4-前端开发)
6. [Phase 5: 测试与部署](#6-phase-5-测试与部署)
7. [附录: 完整代码清单](#7-附录-完整代码清单)

---

## 1. 实施概述

### 1.1 技术架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              系统架构图                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────┐      ┌─────────────────┐      ┌───────────────────┐   │
│   │  员工手机端      │      │  大屏展示端      │      │  管理端 (Settings)│   │
│   │  (微信扫码签到)  │      │  (实时动态)      │      │  (签到管理)       │   │
│   └────────┬────────┘      └────────┬────────┘      └─────────┬─────────┘   │
│            │                        │                         │              │
│            └────────────────────────┼─────────────────────────┘              │
│                                     │                                         │
│                                     ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        React 前端应用                                │   │
│   │   ┌───────────────────┐  ┌─────────────┐  ┌────────────────────┐   │   │
│   │   │ CheckInPage.tsx   │  │ DisplayPage │  │ CheckInSettings    │   │   │
│   │   │ (签到+绑定页面)   │  │ (大屏页面)   │  │ (签到设置)        │   │   │
│   │   └───────────────────┘  └─────────────┘  └────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                         │
│                                     ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                  Supabase Edge Function (后端)                       │   │
│   │   ┌─────────────────────┐  ┌─────────────────────────────────────┐  │   │
│   │   │ wechat-oauth        │  │ wechat-bindingANDcheckin           │  │   │
│   │   │ (微信OAuth认证)     │  │ (绑定+签到接口)                     │  │   │
│   │   └─────────────────────┘  └─────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                         │
│                                     ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        微信开放平台 API                              │   │
│   │   • /sns/oauth2/access_token (获取 access_token + openid)          │   │
│   │   • /sns/userinfo (获取用户信息)                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 工作清单

- [ ] **Phase 1**: 微信开放平台配置
- [ ] **Phase 2**: 数据库设计与迁移
- [ ] **Phase 3**: 后端 Edge Function 开发
- [ ] **Phase 4**: 前端页面开发
- [ ] **Phase 5**: 测试与部署

---

## 2. Phase 1: 微信开放平台配置

### 2.1 注册/登录微信开放平台

1. 访问 [微信开放平台](https://open.weixin.qq.com/)
2. 使用管理员微信扫码登录
3. 如未注册，需完成开发者资质认证

### 2.2 创建网站应用

**路径**: 管理中心 → 网站应用 → 创建网站应用

| 配置项     | 值                      | 说明             |
| ---------- | ----------------------- | ---------------- |
| 应用名称   | 年会签到系统            | 用户授权时可见   |
| 应用官网   | https://your-domain.com | 必须是已备案域名 |
| 授权回调域 | your-domain.com         | 不含 https://    |

### 2.3 获取应用凭证

创建成功后，记录以下信息：

| 参数        | 说明         | 示例                               |
| ----------- | ------------ | ---------------------------------- |
| `AppID`     | 应用唯一标识 | `wx1234567890abcdef`               |
| `AppSecret` | 应用密钥     | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

⚠️ **重要**：AppSecret 请妥善保管，仅在后端使用！

### 2.4 配置环境变量

在 Supabase 项目的 Edge Function 环境变量中添加：

```env
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WECHAT_REDIRECT_URI=https://your-domain.com/checkin/callback
```

---

## 3. Phase 2: 数据库设计

### 3.1 创建微信绑定表

在 Supabase SQL 编辑器中执行：

```sql
-- ============================================
-- 微信用户绑定表
-- ============================================
CREATE TABLE IF NOT EXISTS wechat_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 微信信息
  openid VARCHAR(100) NOT NULL,               -- 微信 openid
  unionid VARCHAR(100),                        -- 微信 unionid (跨应用)
  nickname VARCHAR(100),                       -- 微信昵称
  headimgurl VARCHAR(500),                     -- 微信头像

  -- 绑定的员工信息
  employee_id VARCHAR(100) NOT NULL,           -- 工号
  employee_name VARCHAR(100) NOT NULL,         -- 姓名
  department VARCHAR(200),                     -- 部门

  -- 状态
  status VARCHAR(20) DEFAULT 'active',         -- active/disabled

  -- 时间戳
  bound_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 约束
  CONSTRAINT wechat_bindings_openid_unique UNIQUE (openid),
  CONSTRAINT wechat_bindings_status_check CHECK (status IN ('active', 'disabled'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_wechat_bindings_openid ON wechat_bindings(openid);
CREATE INDEX IF NOT EXISTS idx_wechat_bindings_employee ON wechat_bindings(employee_id);
CREATE INDEX IF NOT EXISTS idx_wechat_bindings_status ON wechat_bindings(status);

-- 添加注释
COMMENT ON TABLE wechat_bindings IS '微信用户与员工工号绑定关系表';
COMMENT ON COLUMN wechat_bindings.openid IS '微信用户唯一标识';
COMMENT ON COLUMN wechat_bindings.employee_id IS '绑定的员工工号';
```

### 3.2 RLS 策略

```sql
-- 启用 RLS
ALTER TABLE wechat_bindings ENABLE ROW LEVEL SECURITY;

-- 允许 Edge Function (service_role) 完全访问
CREATE POLICY "wechat_bindings_service_all" ON wechat_bindings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 如果需要前端直接查询（仅读取自己的绑定）
-- CREATE POLICY "wechat_bindings_select_own" ON wechat_bindings
--   FOR SELECT
--   USING (true);
```

---

## 4. Phase 3: 后端 Edge Function 开发

### 4.1 创建 wechat-oauth Edge Function

**路径**: `supabase/functions/wechat-oauth/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WECHAT_APP_ID = Deno.env.get("WECHAT_APP_ID") || "";
const WECHAT_APP_SECRET = Deno.env.get("WECHAT_APP_SECRET") || "";
const WECHAT_REDIRECT_URI = Deno.env.get("WECHAT_REDIRECT_URI") || "";

Deno.serve(async (req: Request) => {
  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ===== 1. 生成授权 URL =====
    if (action === "qrcode-url") {
      const state = crypto.randomUUID();
      const redirectUri = encodeURIComponent(WECHAT_REDIRECT_URI);

      const qrcodeUrl =
        `https://open.weixin.qq.com/connect/qrconnect?` +
        `appid=${WECHAT_APP_ID}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&scope=snsapi_login` +
        `&state=${state}` +
        `#wechat_redirect`;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            qrcode_url: qrcodeUrl,
            state: state,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ===== 2. 处理 OAuth 回调，获取用户信息 =====
    if (action === "user-info") {
      const body = await req.json();
      const { code } = body;

      if (!code) {
        throw new Error("Missing code parameter");
      }

      // Step 1: 使用 code 换取 access_token 和 openid
      const tokenUrl =
        `https://api.weixin.qq.com/sns/oauth2/access_token?` +
        `appid=${WECHAT_APP_ID}` +
        `&secret=${WECHAT_APP_SECRET}` +
        `&code=${code}` +
        `&grant_type=authorization_code`;

      const tokenResp = await fetch(tokenUrl);
      const tokenData = await tokenResp.json();

      if (tokenData.errcode) {
        throw new Error(`WeChat API Error: ${tokenData.errmsg}`);
      }

      const { access_token, openid, unionid } = tokenData;

      // Step 2: 获取用户信息（昵称、头像）
      const userInfoUrl =
        `https://api.weixin.qq.com/sns/userinfo?` +
        `access_token=${access_token}` +
        `&openid=${openid}`;

      const userInfoResp = await fetch(userInfoUrl);
      const userInfo = await userInfoResp.json();

      if (userInfo.errcode) {
        throw new Error(`WeChat API Error: ${userInfo.errmsg}`);
      }

      // Step 3: 查询是否已有绑定
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: binding } = await supabase
        .from("wechat_bindings")
        .select("*")
        .eq("openid", openid)
        .eq("status", "active")
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            openid: openid,
            unionid: unionid || null,
            nickname: userInfo.nickname,
            headimgurl: userInfo.headimgurl,
            binding: binding
              ? {
                  employee_id: binding.employee_id,
                  employee_name: binding.employee_name,
                  department: binding.department,
                }
              : null,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error.message,
        },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
```

### 4.2 创建 wechat-bindingANDcheckin Edge Function

**路径**: `supabase/functions/wechat-bindingANDcheckin/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ===== 1. 绑定工号 =====
    if (action === "bind") {
      const body = await req.json();
      const {
        openid,
        unionid,
        nickname,
        headimgurl,
        employee_id,
        employee_name,
      } = body;

      if (!openid || !employee_id) {
        throw new Error("Missing required parameters");
      }

      // 验证工号是否在参与者名单中
      const { data: participant } = await supabase
        .from("participants")
        .select("*")
        .eq("employee_id", employee_id)
        .maybeSingle();

      if (!participant) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "EMPLOYEE_NOT_FOUND",
              message: "工号不在参与者名单中，请确认后重试",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 可选：验证姓名是否匹配
      if (employee_name && participant.name !== employee_name) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NAME_MISMATCH",
              message: "姓名与工号不匹配，请检查输入",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 检查是否已存在绑定
      const { data: existingBinding } = await supabase
        .from("wechat_bindings")
        .select("*")
        .eq("openid", openid)
        .maybeSingle();

      let binding;

      if (existingBinding) {
        // 更新现有绑定
        const { data, error } = await supabase
          .from("wechat_bindings")
          .update({
            employee_id: participant.employee_id,
            employee_name: participant.name,
            department: participant.department,
            nickname,
            headimgurl,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("openid", openid)
          .select()
          .single();

        if (error) throw error;
        binding = data;
      } else {
        // 创建新绑定
        const { data, error } = await supabase
          .from("wechat_bindings")
          .insert({
            openid,
            unionid,
            nickname,
            headimgurl,
            employee_id: participant.employee_id,
            employee_name: participant.name,
            department: participant.department,
          })
          .select()
          .single();

        if (error) throw error;
        binding = data;
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            binding_id: binding.id,
            employee_id: binding.employee_id,
            employee_name: binding.employee_name,
            department: binding.department,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ===== 2. 签到 =====
    if (action === "checkin") {
      const body = await req.json();
      const {
        event_id,
        openid,
        employee_id,
        name,
        department,
        avatar,
        location,
        device_info,
      } = body;

      // 检查是否已签到
      const { data: existingCheckIn } = await supabase
        .from("check_ins")
        .select("*")
        .eq("event_id", event_id)
        .eq("employee_id", employee_id)
        .maybeSingle();

      if (existingCheckIn) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "ALREADY_CHECKED_IN",
              message: "您已签到，无需重复签到",
            },
            data: existingCheckIn,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 查找参与者记录
      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("event_id", event_id)
        .eq("employee_id", employee_id)
        .maybeSingle();

      // 创建签到记录
      const { data: checkIn, error } = await supabase
        .from("check_ins")
        .insert({
          event_id,
          participant_id: participant?.id,
          employee_id,
          name,
          department,
          avatar,
          check_in_time: new Date().toISOString(),
          location_lat: location?.latitude,
          location_lng: location?.longitude,
          location_accuracy: location?.accuracy,
          device_info,
          check_in_method: "wechat",
        })
        .select()
        .single();

      if (error) throw error;

      // 更新参与者状态
      if (participant) {
        await supabase
          .from("participants")
          .update({
            status: "checked_in",
            check_in_id: checkIn.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", participant.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            check_in_id: checkIn.id,
            check_in_time: checkIn.check_in_time,
            message: "签到成功！",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error.message,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
```

---

## 5. Phase 4: 前端开发

### 5.1 更新类型定义

**文件**: `src/types/checkin.ts`

添加新的状态和类型：

```typescript
// 页面状态扩展
export type CheckInPageState =
  | "loading"
  | "show_qrcode"
  | "authorizing"
  | "binding_required" // 新增：需要绑定工号
  | "binding" // 新增：绑定中
  | "get_location"
  | "confirm"
  | "checking_in"
  | "success"
  | "already_checked"
  | "auth_failed"
  | "error";

// 微信用户信息
export interface WeChatUserInfo {
  openid: string;
  unionid?: string;
  nickname: string;
  headimgurl: string;
  binding: WeChatBinding | null;
}

// 微信绑定信息
export interface WeChatBinding {
  employee_id: string;
  employee_name: string;
  department?: string;
}
```

### 5.2 修改 CheckInPage.tsx

**核心变更**：

1. 添加工号绑定表单状态
2. 添加绑定 API 调用
3. 更新用户流程逻辑

```tsx
// 新增状态
const [wechatUser, setWechatUser] = useState<WeChatUserInfo | null>(null);
const [bindingForm, setBindingForm] = useState({
  employeeId: "",
  employeeName: "",
});
const [bindingError, setBindingError] = useState("");

// 新增绑定表单渲染函数
const renderBindingRequired = () => (
  <div className="flex flex-col min-h-screen p-6">
    {/* 顶部微信用户信息 */}
    <div className="text-center mb-8">
      <img
        src={wechatUser?.headimgurl || "/default-avatar.png"}
        alt="微信头像"
        className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/20"
      />
      <p className="text-lg text-gray-300">{wechatUser?.nickname}</p>
    </div>

    {/* 绑定表单 */}
    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
      <h2 className="text-xl font-bold text-white mb-6 text-center">
        首次使用请绑定工号
      </h2>

      {/* 工号输入 */}
      <div className="mb-4">
        <label className="block text-gray-400 text-sm mb-2">
          请输入您的工号
        </label>
        <input
          type="text"
          value={bindingForm.employeeId}
          onChange={(e) =>
            setBindingForm((prev) => ({ ...prev, employeeId: e.target.value }))
          }
          placeholder="例如: EMP001"
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 姓名输入（用于验证） */}
      <div className="mb-6">
        <label className="block text-gray-400 text-sm mb-2">
          请输入您的姓名（用于验证）
        </label>
        <input
          type="text"
          value={bindingForm.employeeName}
          onChange={(e) =>
            setBindingForm((prev) => ({
              ...prev,
              employeeName: e.target.value,
            }))
          }
          placeholder="例如: 张三"
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 错误提示 */}
      {bindingError && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm">
          {bindingError}
        </div>
      )}

      {/* 绑定按钮 */}
      <button
        onClick={handleBinding}
        disabled={!bindingForm.employeeId}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        确认绑定并签到
      </button>

      <p className="text-gray-500 text-sm text-center mt-4">
        绑定后下次扫码将自动识别您的身份
      </p>
    </div>
  </div>
);

// 绑定处理函数
const handleBinding = async () => {
  if (!wechatUser || !bindingForm.employeeId) return;

  setPageState("binding");
  setBindingError("");

  try {
    const response = await fetch(
      `${EDGE_FUNCTION_URL}/wechat-bindingANDcheckin?action=bind`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openid: wechatUser.openid,
          unionid: wechatUser.unionid,
          nickname: wechatUser.nickname,
          headimgurl: wechatUser.headimgurl,
          employee_id: bindingForm.employeeId,
          employee_name: bindingForm.employeeName || undefined,
        }),
      },
    );

    const result = await response.json();

    if (!result.success) {
      setBindingError(result.error?.message || "绑定失败，请重试");
      setPageState("binding_required");
      return;
    }

    // 绑定成功，更新用户信息
    setUserInfo({
      employeeId: result.data.employee_id,
      name: result.data.employee_name,
      department: result.data.department,
      avatar: wechatUser.headimgurl,
    });

    // 继续签到流程
    if (settings?.requireLocation) {
      setPageState("get_location");
      requestLocation();
    } else {
      setPageState("confirm");
    }
  } catch (error) {
    setBindingError("网络错误，请重试");
    setPageState("binding_required");
  }
};
```

### 5.3 完整前端代码（关键部分）

参考 [附录 A](#a-checkInpagetsx-完整代码)

---

## 6. Phase 5: 测试与部署

### 6.1 本地测试

#### 6.1.1 使用微信测试号

1. 访问 [微信测试号管理](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)
2. 获取测试号 AppID 和 AppSecret
3. 配置测试回调域名

#### 6.1.2 测试流程

```
1. 启动本地开发服务器
   $ npm run dev

2. 使用 ngrok 暴露本地服务
   $ ngrok http 5173

3. 在微信测试号后台配置 ngrok 域名

4. 使用手机微信扫码测试完整流程
```

### 6.2 部署 Edge Function

```bash
# 部署 wechat-oauth
supabase functions deploy wechat-oauth --project-ref your-project-ref

# 部署 wechat-bindingANDcheckin
supabase functions deploy wechat-bindingANDcheckin --project-ref your-project-ref
```

### 6.3 配置 Edge Function 环境变量

在 Supabase Dashboard 中配置：

```
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WECHAT_REDIRECT_URI=https://your-domain.com/checkin/callback
```

### 6.4 部署清单

- [ ] 微信开放平台应用配置完成
- [ ] 数据库表 `wechat_bindings` 创建完成
- [ ] Edge Function `wechat-oauth` 部署完成
- [ ] Edge Function `wechat-bindingANDcheckin` 部署完成
- [ ] Edge Function 环境变量配置完成
- [ ] 前端应用部署完成
- [ ] 完整流程测试通过

---

## 7. 附录: 完整代码清单

### A. CheckInPage.tsx 关键修改

```tsx
// 在 renderContent 中添加新状态处理
const renderContent = () => {
  switch (pageState) {
    case "loading":
      return renderLoading();
    case "show_qrcode":
      return renderQRCode();
    case "authorizing":
      return renderAuthorizing();
    case "binding_required": // 新增
      return renderBindingRequired();
    case "binding": // 新增
      return renderBinding();
    case "get_location":
      return renderGetLocation();
    case "confirm":
      return renderConfirm();
    case "checking_in":
      return renderCheckingIn();
    case "success":
      return renderSuccess();
    case "already_checked":
      return renderAlreadyChecked();
    case "auth_failed":
    case "error":
      return renderError();
    default:
      return renderLoading();
  }
};
```

### B. API 调用封装

```typescript
// src/utils/wechatApi.ts

const EDGE_FUNCTION_BASE = import.meta.env.VITE_SUPABASE_URL + "/functions/v1";

export const wechatApi = {
  // 获取授权 URL
  getQRCodeUrl: async (): Promise<{ qrcode_url: string; state: string }> => {
    const response = await fetch(
      `${EDGE_FUNCTION_BASE}/wechat-oauth?action=qrcode-url`,
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data;
  },

  // 获取用户信息
  getUserInfo: async (code: string): Promise<WeChatUserInfo> => {
    const response = await fetch(
      `${EDGE_FUNCTION_BASE}/wechat-oauth?action=user-info`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data;
  },

  // 绑定工号
  bind: async (params: {
    openid: string;
    unionid?: string;
    nickname: string;
    headimgurl: string;
    employee_id: string;
    employee_name?: string;
  }): Promise<{
    employee_id: string;
    employee_name: string;
    department: string;
  }> => {
    const response = await fetch(
      `${EDGE_FUNCTION_BASE}/wechat-bindingANDcheckin?action=bind`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data;
  },

  // 签到
  checkIn: async (params: {
    event_id: string;
    openid: string;
    employee_id: string;
    name: string;
    department?: string;
    avatar?: string;
    location?: { latitude: number; longitude: number; accuracy: number };
  }): Promise<{ check_in_id: string; check_in_time: string }> => {
    const response = await fetch(
      `${EDGE_FUNCTION_BASE}/wechat-bindingANDcheckin?action=checkin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message);
    return result.data;
  },
};
```

---

_文档结束_
