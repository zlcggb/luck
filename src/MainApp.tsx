import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import LotteryApp from './App';
import { CheckInDisplayPage, CheckInPage } from './pages';
import ProjectListPage from './pages/ProjectListPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import LoginPage from './pages/LoginPage';

/**
 * 抽奖页面包装器 - 提供导航功能
 */
const LotteryPageWrapper = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  
  return (
    <LotteryApp 
      onOpenCheckInDisplay={() => navigate(eventId ? `/display?event=${eventId}` : '/display')}
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
      onBack={() => navigate('/')}
    />
  );
};

/**
 * 主应用路由
 * 使用 React Router 实现路径路由
 * 
 * 路由说明：
 * - /                   : 重定向到项目列表
 * - /login              : 登录页面
 * - /projects           : 项目列表页面（需登录）
 * - /project/:projectId : 项目设置页面
 * - /lottery            : 抽奖主页面（管理员大屏）
 * - /display            : 签到大屏展示页面（管理员）
 * - /checkin            : 用户签到页面（手机端扫码进入）
 */
const MainApp = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 首页 - 直接进入抽奖页面 (本地模式) */}
        <Route path="/" element={<LotteryPageWrapper />} />
        
        {/* 登录页面 */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* 项目列表页面 */}
        <Route path="/projects" element={<ProjectListPage />} />
        
        {/* 项目设置页面 */}
        <Route path="/project/:projectId" element={<ProjectSettingsPage />} />
        
        {/* 抽奖主页面 */}
        <Route path="/lottery" element={<LotteryPageWrapper />} />
        
        {/* 签到大屏展示页面（管理员） */}
        <Route path="/display" element={<DisplayPageWrapper />} />
        
        {/* 用户签到页面（手机端扫码） */}
        <Route path="/checkin" element={<CheckInPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default MainApp;

