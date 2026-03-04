import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import LotteryApp from './App';
import { CheckInDisplayPage, CheckInPage } from './pages';
import ProjectListPage from './pages/ProjectListPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import LoginPage from './pages/LoginPage';
import LotteryGuidePage from './pages/LotteryGuidePage';
import PersonalWheelPage from './pages/PersonalWheelPage';
import TurntableLotteryPage from './pages/TurntableLotteryPage';

/**
 * 管理后台包装器 - 确保 mode=admin 参数存在
 */
const TurntableAdminWrapper = () => {
  const [searchParams] = useSearchParams();
  // 如果 URL 未携带 mode=admin，自动补上
  if (searchParams.get('mode') !== 'admin') {
    const eventId = searchParams.get('event') || '';
    window.history.replaceState({}, '', `/lottery/wheel/admin?event=${eventId}&mode=admin`);
  }
  return <TurntableLotteryPage />;
};

/**
 * 抽奖页面包装器 - 提供导航功能
 * mode=admin 时显示设置按钮，普通用户访问不显示
 */
const LotteryPageWrapper = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const isAdmin = searchParams.get('mode') === 'admin';
  
  return (
    <LotteryApp 
      onOpenCheckInDisplay={() => navigate(eventId ? `/display?event=${eventId}` : '/display')}
      isAdmin={isAdmin}
    />
  );
};

/**
 * 签到大屏页面包装器 - 提供返回功能
 */
const DisplayPageWrapper = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  
  return (
    <CheckInDisplayPage 
      onBack={() => navigate(eventId ? `/lottery?event=${eventId}` : '/lottery')}
      eventId={eventId}
    />
  );
};

/**
 * 主应用路由
 * 使用 React Router 实现路径路由
 * 
 * 路由说明：
 * - /                   : 抽奖入口引导页
 * - /login              : 登录页面
 * - /projects           : 项目列表页面（需登录）
 * - /project/:projectId : 项目设置页面
 * - /lottery            : 抽奖主页面（管理员大屏）
 * - /lottery/rolling    : 轮动抽奖页面（引导页入口）
 * - /lottery/wheel      : 转盘抽奖页面（引导页入口）
 * - /lottery/employee   : 工号入口页面（保留）
 * - /lottery/personal-wheel : 个人扫码转盘页面（员工端）
 * - /display            : 签到大屏展示页面（管理员）
 * - /checkin            : 用户签到页面（手机端扫码进入）
 */
const MainApp = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首页 - 抽奖入口引导页 */}
        <Route path="/" element={<LotteryGuidePage />} />
        
        {/* 登录页面 */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* 项目列表页面 */}
        <Route path="/projects" element={<ProjectListPage />} />
        
        {/* 项目设置页面 */}
        <Route path="/project/:projectId" element={<ProjectSettingsPage />} />
        
        {/* 抽奖主页面 */}
        <Route path="/lottery" element={<LotteryPageWrapper />} />

        {/* 轮动抽奖页面（引导页入口） */}
        <Route path="/lottery/rolling" element={<LotteryPageWrapper />} />

        {/* 转盘抽奖页面（用户端） */}
        <Route path="/lottery/wheel" element={<TurntableLotteryPage />} />

        {/* 管理后台（独立路由，也可用暗码切换） */}
        <Route path="/lottery/wheel/admin" element={<TurntableAdminWrapper />} />

        {/* 工号入口页面（引导页入口） */}
        <Route path="/lottery/employee" element={<CheckInPage />} />

        {/* 个人扫码转盘页面（员工端） */}
        <Route path="/lottery/personal-wheel" element={<PersonalWheelPage />} />
        
        {/* 签到大屏展示页面（管理员） */}
        <Route path="/display" element={<DisplayPageWrapper />} />
        
        {/* 用户签到页面（手机端扫码） */}
        <Route path="/checkin" element={<CheckInPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default MainApp;
