import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, Trophy, Sparkles, RefreshCw, Grid, Gift, 
  ChevronRight, Settings, Upload, Download, FileSpreadsheet, 
  Plus, Trash2, X, Image as ImageIcon 
} from 'lucide-react';

// --- 配置色系 ---
const COLORS = {
  primary: '#3c80fa',   // 科技蓝
  secondary: '#573cfa', // 深邃紫
  accent: '#b63cfa',    // 霓虹粉
  dark: '#0f0c29',      // 背景深色
};

// --- 初始默认数据 ---
const DEFAULT_PRIZES = [
  { id: 1, level: "特等奖", name: "Future Car Model S", image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=300&q=80", count: 1 },
  { id: 2, level: "一等奖", name: "MacBook Pro M3", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=300&q=80", count: 3 },
  { id: 3, level: "二等奖", name: "iPhone 15 Pro", image: "https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&w=300&q=80", count: 10 },
  { id: 4, level: "三等奖", name: "Dyson Hair Dryer", image: "https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=300&q=80", count: 20 },
];

const MOCK_USERS = Array.from({ length: 100 }).map((_, i) => ({
  id: i + 1,
  name: i % 3 === 0 ? `技术部-张伟${i}` : i % 3 === 1 ? `市场部-Lisa${i}` : `行政部-王强${i}`,
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
  dept: i % 3 === 0 ? '技术研发中心' : i % 3 === 1 ? '全球市场部' : '综合管理部',
  wecomId: `user_${i}`
}));

const App = () => {
  // --- 核心状态 ---
  const [prizes, setPrizes] = useState(DEFAULT_PRIZES);
  const [allUsers, setAllUsers] = useState(MOCK_USERS);
  const [winners, setWinners] = useState([]);
  
  // --- UI/控制状态 ---
  const [isRolling, setIsRolling] = useState(false);
  const [isReady, setIsReady] = useState(true); // 新增：是否处于"虚位以待"状态
  const [currentDisplay, setCurrentDisplay] = useState([]); // 屏幕显示的人
  const [showConfetti, setShowConfetti] = useState(false);
  const [batchSize, setBatchSize] = useState(1);
  const [currentPrize, setCurrentPrize] = useState(prizes[prizes.length - 1]);
  const [showSettings, setShowSettings] = useState(false); // 设置弹窗开关

  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // 初始化或切换 batchSize 时，如果是准备状态，填充占位符
  useEffect(() => {
    if (isReady && !isRolling) {
      // 在 Ready 状态下，currentDisplay 为空，由渲染逻辑决定显示"问号"
      setCurrentDisplay([]);
    }
  }, [batchSize, isReady, isRolling]);

  // 当奖项列表变动时，确保 currentPrize 有效
  useEffect(() => {
    if (!prizes.find(p => p.id === currentPrize.id)) {
      if (prizes.length > 0) setCurrentPrize(prizes[prizes.length - 1]);
    }
  }, [prizes, currentPrize]);

  // --- 逻辑函数 ---

  const getRandomBatch = (sourceArray, count) => {
    const result = [];
    const usedIndices = new Set();
    const actualCount = Math.min(count, sourceArray.length);
    while (result.length < actualCount) {
      const idx = Math.floor(Math.random() * sourceArray.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        result.push(sourceArray[idx]);
      }
    }
    return result;
  };

  const toggleLottery = () => {
    if (isRolling) stopLottery();
    else startLottery();
  };

  const startLottery = () => {
    if (allUsers.length === 0) { alert("奖池已空！"); return; }
    if (allUsers.length < batchSize) { alert(`奖池人数不足 ${batchSize} 人！`); return; }

    setIsReady(false); // 退出"虚位以待"状态
    setIsRolling(true);
    setShowConfetti(false);

    // 滚动动画
    timerRef.current = setInterval(() => {
      const batch = getRandomBatch(allUsers, batchSize);
      setCurrentDisplay(batch);
    }, 80);
  };

  const stopLottery = () => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    setIsRolling(false);
    setShowConfetti(true);

    const finalWinners = getRandomBatch(allUsers, batchSize);
    setCurrentDisplay(finalWinners);
    
    const winnersWithPrize = finalWinners.map(w => ({ ...w, prizeLevel: currentPrize.level, prizeName: currentPrize.name, drawnAt: new Date().toLocaleString() }));

    setWinners(prev => [...winnersWithPrize, ...prev]);
    setAllUsers(prev => prev.filter(u => !finalWinners.find(w => w.id === u.id)));
  };

  const resetPool = () => {
    if (window.confirm("确定要重置所有数据吗？中奖记录将被清空，所有用户回到奖池。")) {
      setAllUsers(MOCK_USERS); // 实际项目中这里可能不需要重置 Mock 数据，而是根据需求
      setWinners([]);
      setIsReady(true);
      setShowConfetti(false);
      setCurrentDisplay([]);
    }
  };

  // --- 导入导出逻辑 ---
  
  const handleExportWinners = () => {
    if (winners.length === 0) {
      alert("暂无中奖记录可导出");
      return;
    }
    // 生成 CSV 内容
    const headers = "工号/ID,姓名,部门,奖项等级,奖品名称,中奖时间\n";
    const rows = winners.map(w => `${w.wecomId},${w.name},${w.dept},${w.prizeLevel},${w.prizeName},"${w.drawnAt}"`).join("\n");
    const csvContent = "\uFEFF" + headers + rows; // 添加 BOM 解决 Excel 中文乱码

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "年会中奖名单.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportUsers = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 真实项目中这里使用 FileReader 读取 CSV/XLSX
      // 这里模拟读取成功
      alert(`已选择文件: ${file.name}。\n(演示模式：实际数据未覆盖，仅重置为初始状态)`);
      setAllUsers(MOCK_USERS);
      setWinners([]);
      setIsReady(true);
    }
  };

  // --- 辅助样式 ---
  const getGridClass = (count) => {
    if (count === 1) return "grid-cols-1";
    if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
    return "grid-cols-2 md:grid-cols-3";
  };

  // --- 渲染组件: 虚位以待卡片 ---
  const renderPlaceholder = () => (
    <div className={`
      relative overflow-hidden
      bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl md:rounded-2xl
      flex flex-col items-center justify-center
      shadow-[0_0_20px_rgba(0,0,0,0.2)]
      min-h-[120px] md:min-h-[160px]
      ${batchSize === 1 ? 'h-full' : ''}
    `}>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
      <div className="text-center animate-pulse">
        <div className="text-4xl md:text-6xl font-black text-white/20 mb-2">?</div>
        <div className="text-xs md:text-sm text-[#3c80fa] tracking-[0.3em] uppercase">Ready</div>
      </div>
    </div>
  );

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans text-white selection:bg-pink-500 selection:text-white flex flex-col md:flex-row bg-[#0b0a1a]">
      
      {/* 背景特效 */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse" style={{ backgroundColor: COLORS.primary }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse delay-1000" style={{ backgroundColor: COLORS.secondary }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      {/* ======================= 设置弹窗 (Settings Modal) ======================= */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-[#1a1b2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="text-[#3c80fa]" /> 系统设置 (Admin Panel)
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* 1. 奖项配置 */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2"><Gift size={18}/> 奖项设置</h3>
                  <button 
                    onClick={() => setPrizes([...prizes, { id: Date.now(), level: "新奖项", name: "奖品名称", image: "", count: 1 }])}
                    className="text-xs bg-[#3c80fa] hover:bg-blue-600 px-3 py-1.5 rounded flex items-center gap-1 transition"
                  >
                    <Plus size={14}/> 添加奖项
                  </button>
                </div>
                <div className="space-y-3">
                  {prizes.map((prize, idx) => (
                    <div key={prize.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-white/5 p-4 rounded-xl border border-white/5">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-500 uppercase">奖项等级</label>
                          <input 
                            value={prize.level} 
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].level = e.target.value;
                              setPrizes(newPrizes);
                            }}
                            className="bg-black/30 border border-white/10 rounded px-2 py-1 text-sm focus:border-[#3c80fa] outline-none" 
                          />
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <label className="text-[10px] text-gray-500 uppercase">奖品名称</label>
                          <input 
                            value={prize.name} 
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].name = e.target.value;
                              setPrizes(newPrizes);
                            }}
                            className="bg-black/30 border border-white/10 rounded px-2 py-1 text-sm focus:border-[#3c80fa] outline-none" 
                          />
                        </div>
                         <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-500 uppercase">数量</label>
                          <input 
                            type="number"
                            value={prize.count} 
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].count = parseInt(e.target.value) || 0;
                              setPrizes(newPrizes);
                            }}
                            className="bg-black/30 border border-white/10 rounded px-2 py-1 text-sm focus:border-[#3c80fa] outline-none" 
                          />
                        </div>
                      </div>
                      
                      {/* 图片预览/上传 (模拟) */}
                      <div className="flex items-center gap-2 shrink-0">
                         <div className="w-10 h-10 rounded bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                            {prize.image ? <img src={prize.image} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={14} className="text-gray-600"/>}
                         </div>
                         <button className="text-xs text-gray-400 hover:text-white underline decoration-dashed">更换图</button>
                      </div>

                      <button 
                        onClick={() => setPrizes(prizes.filter(p => p.id !== prize.id))}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded transition shrink-0"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* 2. 数据管理 */}
              <section className="border-t border-white/10 pt-6">
                <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2 mb-4"><FileSpreadsheet size={18}/> 数据管理</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* 导入卡片 */}
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/20 transition group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white/80">导入人员名单</span>
                      <Upload size={18} className="text-[#3c80fa]"/>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">支持 Excel (.xlsx) 或 CSV 格式。请包含工号、姓名、部门列。</p>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 bg-[#3c80fa]/20 hover:bg-[#3c80fa]/30 text-[#3c80fa] rounded text-sm font-bold border border-[#3c80fa]/30 transition"
                       >
                         选择文件
                       </button>
                       <input 
                         type="file" 
                         ref={fileInputRef} 
                         className="hidden" 
                         accept=".csv,.xlsx"
                         onChange={handleImportUsers}
                       />
                       <button className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-400">下载模板</button>
                    </div>
                  </div>

                  {/* 导出卡片 */}
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/20 transition group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white/80">导出中奖记录</span>
                      <Download size={18} className="text-[#b63cfa]"/>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">导出包含完整中奖信息、时间戳的历史记录。</p>
                    <button 
                      onClick={handleExportWinners}
                      className="w-full py-2 bg-[#b63cfa]/20 hover:bg-[#b63cfa]/30 text-[#b63cfa] rounded text-sm font-bold border border-[#b63cfa]/30 transition"
                    >
                      导出 CSV
                    </button>
                  </div>

                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ======================= 主界面 (Sidebar + Main) ======================= */}
      
      {/* Sidebar */}
      <aside className="relative z-20 shrink-0 w-full md:w-72 lg:w-80 h-auto md:h-screen flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-white/10 bg-black/20 backdrop-blur-xl overflow-x-auto md:overflow-x-hidden md:overflow-y-auto no-scrollbar">
        <div className="hidden md:block p-6 border-b border-white/5">
          <div className="flex items-center gap-2 text-white/80 uppercase tracking-widest font-bold text-sm">
            <Gift size={16} className="text-[#b63cfa]" />
            <span>Prize Gallery</span>
          </div>
        </div>
        <div className="flex flex-row md:flex-col p-2 md:p-4 gap-2 md:gap-4 w-full">
          {prizes.map((prize) => {
            const isActive = currentPrize.id === prize.id;
            return (
              <div 
                key={prize.id}
                onClick={() => !isRolling && setCurrentPrize(prize)}
                className={`
                  relative group cursor-pointer rounded-xl md:rounded-2xl transition-all duration-500 ease-out overflow-hidden border shrink-0
                  min-w-[140px] md:min-w-0 md:w-full
                  ${isActive 
                    ? 'h-20 md:h-48 border-[#b63cfa] shadow-[0_0_15px_rgba(182,60,250,0.3)] bg-gradient-to-b from-[#b63cfa]/20 to-transparent' 
                    : 'h-20 md:h-16 border-white/5 bg-white/5 hover:bg-white/10'
                  }
                  ${isRolling ? 'opacity-50 pointer-events-none grayscale' : ''}
                `}
              >
                <div className="absolute inset-0 z-0">
                  <img src={prize.image} alt={prize.name} className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'opacity-40 md:opacity-60 blur-sm' : 'opacity-0'}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a1a] via-[#0b0a1a]/50 to-transparent"></div>
                </div>
                <div className="relative z-10 p-3 md:p-4 h-full flex flex-col justify-center md:justify-between">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                    <span className={`font-black uppercase tracking-wider transition-all duration-300 truncate ${isActive ? 'text-sm md:text-2xl text-white' : 'text-xs md:text-sm text-gray-400'}`}>
                      {prize.level}
                    </span>
                    {isActive && <div className="hidden md:block px-2 py-0.5 rounded bg-[#b63cfa] text-[10px] font-bold">ACTIVE</div>}
                  </div>
                  <div className={`transition-all duration-300 md:block ${isActive ? 'block' : 'hidden'}`}>
                     <div className={`font-bold text-white leading-tight truncate ${isActive ? 'text-xs md:text-lg md:mt-2' : 'hidden'}`}>{prize.name}</div>
                     {isActive && <div className="hidden md:block text-xs text-[#3c80fa] mt-1 font-mono">Qty: {prize.count}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">
        
        {/* Top Header */}
        <header className="w-full flex justify-between items-center border-b border-white/10 px-4 py-3 md:px-8 md:py-6 backdrop-blur-sm shrink-0">
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl md:text-4xl font-black tracking-wider uppercase italic bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white drop-shadow-lg flex items-center gap-2 md:gap-3 truncate">
              {currentPrize.level}
              <span className="hidden sm:inline text-lg md:text-2xl text-[#b63cfa] not-italic font-medium">/ {currentPrize.name}</span>
            </h1>
            <p className="text-[#3c80fa] font-medium tracking-[0.2em] uppercase text-[10px] md:text-sm mt-0.5 md:mt-1">
              Lucky Draw System
            </p>
          </div>

          <div className="flex items-center gap-3 md:gap-6 shrink-0">
             {/* 抽奖人数 */}
            <div className="flex items-center bg-white/5 rounded-lg p-0.5 md:p-1 border border-white/10">
              {[1, 4, 6, 9].map(num => (
                <button
                  key={num}
                  onClick={() => !isRolling && setBatchSize(num)}
                  disabled={isRolling}
                  className={`
                    px-2 py-1 md:px-3 rounded text-xs md:text-sm font-bold transition-all
                    ${batchSize === num ? 'bg-[#3c80fa] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                    ${isRolling ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* 设置按钮 */}
            <div className="h-6 w-[1px] bg-white/10"></div>
            <button 
              onClick={() => setShowSettings(true)}
              disabled={isRolling}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition"
              title="设置"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* 核心显示区 */}
        <main className="flex-1 w-full relative p-4 md:p-6 flex flex-col items-center justify-center overflow-y-auto no-scrollbar">
          
          <div className={`
            relative z-20 w-full transition-all duration-500
            grid gap-3 md:gap-6
            ${getGridClass(batchSize)}
            ${batchSize === 1 ? 'max-w-4xl h-full max-h-[50vh] md:max-h-[60vh]' : 'max-w-6xl h-auto'}
          `}>
            {/* 根据状态渲染：
                1. isReady (虚位以待) -> 显示 N 个问号卡片
                2. !isReady -> 显示 currentDisplay (滚动中或结果)
            */}
            {isReady 
              ? Array.from({ length: batchSize }).map((_, i) => <React.Fragment key={i}>{renderPlaceholder()}</React.Fragment>)
              : currentDisplay.map((user, idx) => (
                  <div 
                    key={`${user.id}-${idx}`}
                    className={`
                      relative overflow-hidden
                      bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl
                      flex flex-col items-center justify-center
                      shadow-[0_0_20px_rgba(0,0,0,0.3)]
                      transition-all duration-300
                      ${showConfetti ? 'ring-2 ring-[#b63cfa] scale-[1.02] shadow-[0_0_30px_rgba(182,60,250,0.3)]' : ''}
                      min-h-[120px] md:min-h-[160px]
                      ${batchSize === 1 ? 'h-full' : ''} 
                    `}
                  >
                    {/* 右上角奖品标记 */}
                    <div className="hidden md:block absolute top-0 right-0 p-3 opacity-20">
                      <img src={currentPrize.image} className="w-8 h-8 rounded opacity-50 grayscale" alt="" />
                    </div>

                    <div className={`flex items-center w-full px-4 ${batchSize === 1 ? 'flex-col md:flex-row gap-4 md:gap-8 justify-center' : 'flex-row gap-3 md:gap-4'}`}>
                      <div className={`relative shrink-0 ${batchSize === 1 ? 'order-1' : ''}`}>
                        {isRolling && <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#3c80fa] to-[#b63cfa] blur-md animate-spin"></div>}
                        <img 
                          src={user.avatar} alt="avatar" 
                          className={`
                            relative rounded-full border-2 object-cover shadow-2xl transition-all
                            ${batchSize === 1 ? 'w-24 h-24 md:w-48 md:h-48 border-4' : 'w-12 h-12 md:w-20 md:h-20'}
                            ${isRolling ? 'border-white/20 scale-95' : 'border-[#b63cfa] scale-100'}
                          `}
                        />
                      </div>
                      <div className={`flex flex-col min-w-0 flex-1 ${batchSize === 1 ? 'items-center md:items-start text-center md:text-left order-2' : ''}`}>
                        <h2 className={`font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-md truncate w-full ${batchSize === 1 ? 'text-3xl md:text-6xl' : 'text-sm md:text-2xl'} ${isRolling ? 'blur-[1px]' : ''}`}>
                          {user.name.split('-')[1] || user.name}
                        </h2>
                        <p className={`font-light tracking-widest text-[#3c80fa] uppercase truncate w-full ${batchSize === 1 ? 'text-sm md:text-2xl mt-1 md:mt-2' : 'text-[10px] md:text-xs mt-0.5 md:mt-1'}`}>
                          {user.dept}
                        </p>
                      </div>
                    </div>
                    {showConfetti && <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#b63cfa] rounded text-[8px] md:text-[10px] font-bold uppercase tracking-wider animate-bounce shadow-lg z-10">Winner</div>}
                  </div>
              ))
            }
          </div>
          
          <div className="mt-6 md:mt-10 pb-4 z-30 shrink-0 flex gap-4">
            {/* 重置按钮 (小) */}
            <button onClick={resetPool} disabled={isRolling} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition" title="重置本轮">
               <RefreshCw size={20} />
            </button>

            {/* 开始/停止大按钮 */}
            <button
              onClick={toggleLottery}
              className={`
                group relative px-8 py-3 md:px-16 md:py-4 rounded-full font-bold text-lg md:text-2xl tracking-widest uppercase
                transition-all duration-300 transform hover:scale-105 active:scale-95
                shadow-[0_10px_40px_rgba(0,0,0,0.6)]
                overflow-hidden
                ${isRolling 
                  ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white ring-2 md:ring-4 ring-red-500/30' 
                  : 'bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white ring-2 md:ring-4 ring-[#3c80fa]/30'
                }
              `}
            >
              <span className="relative z-10 flex items-center gap-2 md:gap-3">
                {isRolling ? <Square fill="currentColor" size={16} className="md:w-5 md:h-5"/> : <Play fill="currentColor" size={16} className="md:w-5 md:h-5"/>}
                {isRolling ? "STOP" : (isReady ? "START" : `AGAIN`)}
              </span>
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shiny" />
            </button>
          </div>
        </main>

        {/* Footer 历史记录 */}
        <footer className="w-full h-14 md:h-20 bg-black/40 backdrop-blur-md border-t border-white/5 flex flex-col justify-center shrink-0 z-20">
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto px-4 py-2 no-scrollbar scroll-smooth h-full">
            {winners.length === 0 ? (
              <div className="w-full text-center text-gray-600 italic text-xs md:text-sm">暂无中奖者 (Waiting for results...)</div>
            ) : (
              winners.slice(0, 20).map((winner, idx) => (
                <div key={`${winner.id}-${idx}`} className="flex-shrink-0 flex items-center gap-2 bg-white/5 pr-3 pl-1.5 py-1 rounded-full border border-white/10">
                  <span className="text-[9px] md:text-[10px] bg-[#3c80fa] px-1.5 py-0.5 rounded text-white font-bold whitespace-nowrap">{winner.prizeLevel}</span>
                  <img src={winner.avatar} className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-white/20" alt="" />
                  <span className="text-white font-bold text-[10px] md:text-xs whitespace-nowrap">{winner.name.split('-')[1]}</span>
                </div>
              ))
            )}
          </div>
        </footer>

      </div>

      <style>{`
        @keyframes shiny { 0% { left: -100%; } 100% { left: 200%; } }
        .animate-shiny { animation: shiny 1.5s infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;