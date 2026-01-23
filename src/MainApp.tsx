import { useState, useEffect } from 'react';
import LotteryApp from './App';
import { CheckInDisplayPage } from './pages';

// 页面类型
type PageType = 'lottery' | 'checkin-display' | 'checkin-mobile';

/**
 * 主应用路由
 * 整合抽奖系统和签到系统
 */
const MainApp = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('lottery');

  // 检测 URL 参数决定显示哪个页面
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    
    if (page === 'checkin') {
      setCurrentPage('checkin-mobile');
    } else if (page === 'display') {
      setCurrentPage('checkin-display');
    }
  }, []);

  // 根据页面类型渲染
  switch (currentPage) {
    case 'checkin-display':
      return (
        <CheckInDisplayPage 
          onBack={() => setCurrentPage('lottery')}
        />
      );
    
    case 'lottery':
    default:
      return (
        <LotteryApp 
          onOpenCheckInDisplay={() => setCurrentPage('checkin-display')}
        />
      );
  }
};

export default MainApp;
