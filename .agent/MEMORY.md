# 项目记忆文件

## Supabase 配置

- **MCP 服务器**: `supabase-mcp-hw`
- **项目 ID**: `jkxjpopqbkjpevkcncrr`
- **项目名称**: Luck (抽奖/签到系统)

## 数据库表结构

### luck_events (活动表)

- `id` - UUID 主键
- `name` - 活动名称
- `description` - 活动描述
- `event_date` - 活动日期
- `location_name` - 位置名称
- `location_lat` - 纬度
- `location_lng` - 经度
- `location_radius` - 有效签到半径(米)
- `require_location` - 是否需要定位
- `status` - 状态 (draft/active/completed)
- `checkin_open` - 签到是否开放
- `checkin_start_time` - 签到开始时间
- `checkin_end_time` - 签到结束时间
- `checkin_duration` - 签到时长(分钟)

### luck_participants (参与者表)

- `id` - UUID 主键
- `event_id` - 活动ID
- `employee_id` - 工号
- `name` - 姓名
- `department` - 部门
- `avatar` - 头像
- `status` - 状态 (pending/checked_in)

### luck_check_ins (签到记录表)

- `id` - UUID 主键
- `event_id` - 活动ID
- `participant_id` - 参与者ID
- `employee_id` - 工号
- `name` - 姓名
- `department` - 部门
- `check_in_time` - 签到时间
- `location_lat` - 签到位置纬度
- `location_lng` - 签到位置经度
- `check_in_method` - 签到方式 (qrcode/manual)

## 更新日志

- 2026-01-24: 添加签到会话管理字段 (checkin_open, checkin_start_time, checkin_end_time, checkin_duration)
