import { useState, useEffect, useRef } from 'react';
import { Play, Square, Trophy, Grid, HelpCircle, Settings, Gift, ChevronRight, X } from 'lucide-react';
import {
  Participant,
  Prize,
  DrawRecord,
  DEFAULT_PRIZES,
  BackgroundMusicSettings,
  DEFAULT_BACKGROUND_MUSIC,
} from './types';
import { 
  saveParticipants, loadParticipants, 
  savePrizes, loadPrizes, 
  saveRecords, loadRecords,
  saveExcludedIds, loadExcludedIds,
  clearAllData,
  saveBackgroundMusicSettings,
  loadBackgroundMusicSettings,
} from './utils/storage';
import { 
  needsSpecialLayout, 
  getSpecialLayoutRows, 
  getGridClass, 
  getDrawingCardStyle,
  calculateSummaryLayout
} from './utils/layoutAlgorithm';
import SettingsPanel from './components/SettingsPanel';
import { useModal } from './contexts/ModalContext';

// --- 配置色系 ---
const COLORS = {
  primary: '#3c80fa',
  secondary: '#573cfa',
  accent: '#b63cfa',
  dark: '#0f0c29',
};

// --- 模拟数据 (当无导入数据时使用) ---
const MOCK_PARTICIPANTS: Participant[] = Array.from({ length: 100 }).map((_, i) => ({
  id: `EMP${String(i + 1).padStart(3, '0')}`,
  name: i % 3 === 0 ? `张伟${i}` : i % 3 === 1 ? `Lisa${i}` : `王强${i}`,
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
  dept: i % 3 === 0 ? '技术研发中心' : i % 3 === 1 ? '全球市场部' : '综合管理部',
}));

interface AppProps {
  onOpenCheckInDisplay?: () => void;
}

const App = ({ onOpenCheckInDisplay }: AppProps) => {
  // 核心状态
  const [participants, setParticipants] = useState<Participant[]>([]); // 所有参与者
  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_PRIZES);        // 奖项配置
  const [records, setRecords] = useState<DrawRecord[]>([]);             // 抽奖记录
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set()); // 已中奖ID
  
  // UI 状态
  const [isRolling, setIsRolling] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<Participant[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAllWinners, setShowAllWinners] = useState(false); // 控制是否显示奖项汇总页
  const [mobilePrizeSidebarOpen, setMobilePrizeSidebarOpen] = useState(false); // 移动端奖项侧边栏
  
  // 当前选中的奖项和抽取数量
  const [currentPrizeId, setCurrentPrizeId] = useState<string>('');
  const [batchSize, setBatchSize] = useState(1);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 使用内部弹窗
  const { showWarning, showConfirm } = useModal();

  // --- 初始化：从 LocalStorage 加载数据 ---
  const [isInitialized, setIsInitialized] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState<BackgroundMusicSettings>(DEFAULT_BACKGROUND_MUSIC);
  
  useEffect(() => {
    const savedParticipants = loadParticipants();
    const savedPrizes = loadPrizes();
    const savedRecords = loadRecords();
    const savedExcludedIds = loadExcludedIds();
    const savedBackgroundMusic = loadBackgroundMusicSettings();
    
    // 如果没有保存的参与者，使用模拟数据
    setParticipants(savedParticipants.length > 0 ? savedParticipants : MOCK_PARTICIPANTS);
    setPrizes(savedPrizes);
    setRecords(savedRecords);
    setExcludedIds(savedExcludedIds);
    setBackgroundMusic(savedBackgroundMusic);
    
    // 设置默认选中的奖项
    if (savedPrizes.length > 0) {
      const firstUnfinished = savedPrizes.find(p => p.drawn < p.count);
      setCurrentPrizeId(firstUnfinished?.id || savedPrizes[0].id);
    }
    
    // 标记初始化完成
    setIsInitialized(true);
  }, []);

  // --- 持久化数据（只在初始化完成后才保存） ---
  useEffect(() => {
    if (!isInitialized) return;
    saveParticipants(participants);
  }, [participants, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    savePrizes(prizes);
  }, [prizes, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveRecords(records);
  }, [records, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveExcludedIds(excludedIds);
  }, [excludedIds, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveBackgroundMusicSettings(backgroundMusic);
  }, [backgroundMusic, isInitialized]);

  useEffect(() => {
    if (backgroundMusic.src) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [backgroundMusic.src]);

  // --- 计算可用参与者（排除已中奖的） ---
  const availableParticipants = participants.filter(p => !excludedIds.has(p.id));

  // --- 获取当前奖项信息 ---
  const currentPrize = prizes.find(p => p.id === currentPrizeId);
  
  // 计算当前奖项剩余名额
  const remainingSlots = currentPrize ? currentPrize.count - currentPrize.drawn : 0;

  // 获取当前奖项的所有中奖者（用于奖项抽完后展示）
  const getCurrentPrizeWinners = (): Participant[] => {
    if (!currentPrize) return [];
    return records
      .filter(r => r.prizeId === currentPrize.id)
      .flatMap(r => r.winners);
  };

  // 判断当前奖项是否已抽完
  const isPrizeCompleted = currentPrize ? currentPrize.drawn >= currentPrize.count : false;

  // 计算一个数的所有因数（用于确定可选的抽取人数）
  const getFactors = (n: number): number[] => {
    if (n <= 0) return [1];
    const factors: number[] = [];
    for (let i = 1; i <= Math.min(n, 16); i++) { // 限制最大16人
      if (n % i === 0) {
        factors.push(i);
      }
    }
    // 如果没有找到合适的因数，至少返回1
    return factors.length > 0 ? factors : [1];
  };

  // 计算当前奖项可用的抽取人数选项（剩余名额的因数）
  const availableBatchSizes = getFactors(remainingSlots);

  // 用户主动重置显示的函数（用于用户点击人数/奖项按钮时调用）
  const resetDisplay = (alsoResetWinnersView = true) => {
    if (!isRolling) {
      setCurrentDisplay([]);
      setShowConfetti(false);
      setHasDrawn(false);
      if (alsoResetWinnersView) {
        setShowAllWinners(false);
      }
    }
  };

  // 用户主动点击切换人数
  const handleBatchSizeChange = (newSize: number) => {
    if (isRolling) return;
    if (!availableBatchSizes.includes(newSize)) return;
    if (newSize !== batchSize) {
      setBatchSize(newSize);
      resetDisplay();
    }
  };

  // 用户主动点击切换奖项
  const handlePrizeChange = (prizeId: string) => {
    if (isRolling) return;
    if (prizeId !== currentPrizeId) {
      setCurrentPrizeId(prizeId);
      
      // 计算新奖项的剩余名额和可用抽取人数
      const newPrize = prizes.find(p => p.id === prizeId);
      if (newPrize) {
        const newRemaining = newPrize.count - newPrize.drawn;
        const newFactors = getFactors(newRemaining);
        
        // 自动选择一个合适的默认抽取人数（优先选择较大的因数，但不超过当前选择）
        if (!newFactors.includes(batchSize)) {
          // 找到小于等于当前选择的最大因数，或者最大因数
          const suitable = newFactors.filter(f => f <= batchSize);
          setBatchSize(suitable.length > 0 ? Math.max(...suitable) : Math.max(...newFactors));
        }
        
        // 如果切换到已抽完的奖项，自动显示汇总页
        if (newRemaining <= 0) {
          setShowAllWinners(true);
        } else {
          setShowAllWinners(false);
        }
      }
      
      resetDisplay(false); // 不重置汇总页状态，因为上面已经处理了
    }
  };

  // 当剩余名额变化时，静默调整抽取人数到合适值（不重置显示）
  useEffect(() => {
    if (currentPrize && remainingSlots > 0 && !isRolling && !showConfetti) {
      const factors = getFactors(remainingSlots);
      // 如果当前选择不在可用因数中，调整到最大可用因数
      if (!factors.includes(batchSize)) {
        const suitable = factors.filter(f => f <= batchSize);
        setBatchSize(suitable.length > 0 ? Math.max(...suitable) : Math.max(...factors));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSlots]);

  // --- 辅助：从数组中随机取 N 个不重复的人 ---
  const getRandomBatch = (sourceArray: Participant[], count: number): Participant[] => {
    const result: Participant[] = [];
    const usedIndices = new Set<number>();
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

  // --- 核心逻辑：开始/停止抽奖 ---
  const toggleLottery = () => {
    if (isRolling) {
      stopLottery();
    } else {
      startLottery();
    }
  };

  const startLottery = () => {
    if (availableParticipants.length === 0) {
      showWarning("奖池已空！请导入参与者名单。");
      return;
    }
    if (availableParticipants.length < batchSize) {
      showWarning(`奖池人数不足 ${batchSize} 人！`);
      return;
    }
    if (!currentPrize) {
      showWarning("请先选择一个奖项！");
      return;
    }
    if (currentPrize.drawn >= currentPrize.count) {
      showWarning(`${currentPrize.name} 已全部抽完！`);
      return;
    }
    // 检查抽取人数是否超过剩余名额
    const remaining = currentPrize.count - currentPrize.drawn;
    if (batchSize > remaining) {
      showWarning(`${currentPrize.name} 剩余 ${remaining} 个名额，无法抽取 ${batchSize} 人！`);
      return;
    }

    setIsRolling(true);
    setShowConfetti(false);
    if (backgroundMusic.autoPlayOnDraw && backgroundMusic.src && audioRef.current?.paused) {
      audioRef.current.play().catch(() => null);
    }

    timerRef.current = setInterval(() => {
      const batch = getRandomBatch(availableParticipants, batchSize);
      setCurrentDisplay(batch);
    }, 80);
  };

  const stopLottery = () => {
    if (!timerRef.current || !currentPrize) return;
    
    clearInterval(timerRef.current);
    setIsRolling(false);
    setShowConfetti(true);

    const finalWinners = getRandomBatch(availableParticipants, batchSize);
    setCurrentDisplay(finalWinners);
    setHasDrawn(true);
    
    // 创建抽奖记录
    const newRecord: DrawRecord = {
      id: `record_${Date.now()}`,
      timestamp: Date.now(),
      prizeId: currentPrize.id,
      prizeName: currentPrize.name,
      winners: finalWinners,
    };
    setRecords(prev => [newRecord, ...prev]);
    
    // 更新已中奖ID集合
    const newExcludedIds = new Set(excludedIds);
    finalWinners.forEach(w => newExcludedIds.add(w.id));
    setExcludedIds(newExcludedIds);
    
    // 更新奖项已抽取数量
    setPrizes(prev => prev.map(p => 
      p.id === currentPrize.id 
        ? { ...p, drawn: p.drawn + finalWinners.length }
        : p
    ));
  };

  // 撤销某轮抽奖
  const handleUndoRecord = async (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;
    
    const confirmed = await showConfirm(`确定要撤销本轮抽奖吗？\n奖项：${record.prizeName}\n中奖者：${record.winners.map(w => w.name).join('、')}`);
    if (!confirmed) {
      return;
    }
    
    // 从已中奖集合中移除
    const newExcludedIds = new Set(excludedIds);
    record.winners.forEach(w => newExcludedIds.delete(w.id));
    setExcludedIds(newExcludedIds);
    
    // 更新奖项已抽取数量
    setPrizes(prev => prev.map(p => 
      p.id === record.prizeId 
        ? { ...p, drawn: Math.max(0, p.drawn - record.winners.length) }
        : p
    ));
    
    // 删除记录
    setRecords(prev => prev.filter(r => r.id !== recordId));
  };

  // 清除所有数据
  const handleClearAll = () => {
    clearAllData();
    setParticipants(MOCK_PARTICIPANTS);
    setPrizes(DEFAULT_PRIZES);
    setRecords([]);
    setExcludedIds(new Set());
    setBackgroundMusic(DEFAULT_BACKGROUND_MUSIC);
    setCurrentDisplay([]);
    setShowConfetti(false);
    setHasDrawn(false);
    setCurrentPrizeId(DEFAULT_PRIZES[0].id);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };



  // 使用布局算法获取卡片样式
  const cardStyle = getDrawingCardStyle(batchSize);

  // 获取最近中奖者（用于底部走马灯）
  const recentWinners = records.flatMap(r => r.winners).slice(0, 20);

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans text-white selection:bg-pink-500 selection:text-white">
      <audio ref={audioRef} src={backgroundMusic.src || undefined} loop preload="auto" className="hidden" />
      
      {/* --- 背景层 --- */}
      <div className="absolute inset-0 z-0 bg-[#0b0a1a]">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"
          style={{ backgroundColor: COLORS.primary }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse delay-1000"
          style={{ backgroundColor: COLORS.secondary }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,41,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,16,41,0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] border-white/5"></div>
      </div>

      {/* --- 主内容容器 --- */}
      <div className="relative z-10 flex flex-col h-screen p-3 md:p-4 lg:p-6">
        
        {/* 1. 顶部 Header - Updated Design for Mobile */}
        <header className="w-full flex justify-between items-center px-4 py-4 md:px-6 md:py-6 border-b border-white/5 backdrop-blur-sm shrink-0">
          <div className="flex flex-col max-w-[65%] md:max-w-none">
            <h1 className="text-2xl md:text-5xl font-black tracking-wider uppercase italic flex flex-wrap items-center gap-2 md:gap-3 leading-none">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400 drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                {currentPrize ? currentPrize.name : 'ANNUAL GALA'}
              </span>
              <span className="text-lg md:text-3xl text-[#b63cfa] not-italic font-medium opacity-80 decoration-2 underline-offset-4">
                 <span className="hidden md:inline">/ </span>
                 {currentPrize ? (currentPrize.description || currentPrize.name) : 'LUCKY DRAW'}
              </span>
            </h1>
            <p className="text-[#3c80fa] font-medium tracking-[0.2em] uppercase text-[9px] md:text-xs mt-1 md:mt-2 ml-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
              Lucky Draw System
            </p>
          </div>

          {/* 右侧控制区 */}
          <div className="flex items-center gap-2 md:gap-6">
            
            {/* 抽取人数选择 */}
            <div className="flex items-center bg-[#0b0a1a]/50 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-inner scale-90 md:scale-100 origin-right">
              {availableBatchSizes.length === 0 ? (
                <span className="text-gray-500 text-xs px-3 py-1">--</span>
              ) : (
                availableBatchSizes.map(num => (
                  <button
                    key={num}
                    onClick={() => handleBatchSizeChange(num)}
                    disabled={isRolling}
                    className={`
                      w-8 h-8 md:w-10 md:h-10 rounded-lg text-sm md:text-base font-bold transition-all flex items-center justify-center
                      ${batchSize === num 
                        ? 'bg-[#3c80fa] text-white shadow-lg scale-105' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }
                      ${isRolling ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {num}
                  </button>
                ))
              )}
            </div>

             {/* 设置按钮 */}
             <div className="h-8 w-[1px] bg-white/10 hidden md:block"></div>
             
             <button 
               onClick={() => setSettingsOpen(true)} 
               className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white border border-white/5 transition-all hover:rotate-90 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] shrink-0"
               title="设置"
             >
               <Settings size={18} className="md:w-5 md:h-5" />
             </button>
          </div>
        </header>

        {/* 2. 主体区域：左侧奖项 + 中间抽奖区 */}
        <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-4 mt-2 md:mt-3 min-h-0 overflow-hidden">
          
          {/* 左侧奖项侧边栏 - Mobile: Collapsible Drawer / Desktop: Vertical Sidebar */}
          


          {/* Mobile: 折叠侧边栏抽屉 */}
          <div 
            className={`
              md:hidden fixed inset-0 z-50 transition-all duration-300
              ${mobilePrizeSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}
            `}
          >
            {/* 背景遮罩 */}
            <div 
              className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobilePrizeSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setMobilePrizeSidebarOpen(false)}
            />
            
            {/* 侧边栏内容 */}
            <div 
              className={`
                absolute left-0 top-0 bottom-0 w-72
                bg-gradient-to-br from-[#0f0c29]/98 via-[#1a1535]/98 to-[#0b0a1a]/98
                backdrop-blur-2xl border-r border-white/10
                shadow-[5px_0_30px_rgba(0,0,0,0.5)]
                transition-transform duration-300 ease-out
                flex flex-col
                ${mobilePrizeSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              `}
            >
              {/* 侧边栏头部 */}
              <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80 uppercase tracking-widest font-bold text-sm">
                  <Gift size={18} className="text-[#b63cfa]" />
                  <span>Prize Gallery</span>
                </div>
                <button 
                  onClick={() => setMobilePrizeSidebarOpen(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X size={18} className="text-white/60" />
                </button>
              </div>

              {/* 奖项列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                {prizes.map((prize) => {
                  const isActive = currentPrizeId === prize.id;
                  const isCompleted = prize.drawn >= prize.count;
                  const progress = (prize.drawn / prize.count) * 100;
                  
                  return (
                    <div 
                      key={prize.id}
                      onClick={() => {
                        handlePrizeChange(prize.id);
                        setMobilePrizeSidebarOpen(false);
                      }}
                      className={`
                        relative cursor-pointer rounded-xl transition-all duration-300 overflow-hidden
                        ${isActive 
                          ? 'bg-gradient-to-r from-[#b63cfa]/30 via-[#573cfa]/20 to-transparent border border-[#b63cfa]/50 shadow-[0_0_20px_rgba(182,60,250,0.2)]' 
                          : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                        }
                        ${isRolling ? 'opacity-50 pointer-events-none' : ''}
                      `}
                    >
                      <div className="p-3 flex items-center gap-3">
                        {/* 奖项图标/图片 */}
                        <div className={`
                          w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden
                          ${isActive 
                            ? 'bg-gradient-to-br from-[#b63cfa] to-[#573cfa]' 
                            : isCompleted 
                              ? 'bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30'
                              : 'bg-white/5 border border-white/10'
                          }
                        `}>
                          {prize.image ? (
                            <img src={prize.image} alt={prize.name} className="w-full h-full object-cover" />
                          ) : (
                            <Trophy size={20} className={isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-white/40'} />
                          )}
                        </div>
                        
                        {/* 奖项信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                              {prize.name}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#b63cfa] text-[8px] font-bold text-white shrink-0">
                                当前
                              </span>
                            )}
                            {isCompleted && !isActive && (
                              <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[8px] font-bold shrink-0">
                                完成
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {prize.description || prize.name}
                          </p>
                          
                          {/* 进度条 */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-[#3c80fa] to-[#b63cfa]'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 ${isCompleted ? 'text-green-400' : 'text-gray-500'}`}>
                              {prize.drawn}/{prize.count}
                            </span>
                          </div>
                        </div>
                        
                        {/* 箭头 */}
                        <ChevronRight size={16} className={`shrink-0 transition-colors ${isActive ? 'text-[#b63cfa]' : 'text-white/20'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 底部装饰 */}
              <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                <div className="text-center text-[10px] text-gray-600 uppercase tracking-wider">
                  点击选择奖项
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: 原有垂直侧边栏 */}
          <aside className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col border-r border-white/5 bg-black/10 backdrop-blur-sm rounded-xl overflow-hidden h-full">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2 text-white/80 uppercase tracking-widest font-bold text-sm">
                <Gift size={16} className="text-[#b63cfa]" />
                <span>Prize Gallery</span>
              </div>
            </div>

            {/* List Container */}
            <div className="flex flex-col p-2 gap-3 overflow-y-auto no-scrollbar h-full">
              {prizes.map((prize) => {
                const isActive = currentPrizeId === prize.id;
                const isCompleted = prize.drawn >= prize.count;
                
                return (
                  <div 
                    key={prize.id}
                    onClick={() => handlePrizeChange(prize.id)}
                    className={`
                      relative group cursor-pointer rounded-2xl transition-all duration-500 ease-out overflow-hidden border
                      ${isActive 
                        ? 'w-full h-48 border-[#b63cfa]/50 shadow-[0_0_30px_rgba(182,60,250,0.25)] bg-gradient-to-br from-[#b63cfa]/30 via-[#573cfa]/20 to-[#0b0a1a]' 
                        : 'w-full h-20 border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/10'
                      }
                      ${isRolling ? 'opacity-50 pointer-events-none grayscale' : ''}
                    `}
                  >
                    {/* Background Image - Only visible when active */}
                    <div className="absolute inset-0 z-0 bg-[#0b0a1a]">
                      {prize.image && (
                        <img 
                          src={prize.image} 
                          alt={prize.name} 
                          className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'opacity-60 blur-[2px] scale-110' : 'opacity-0 scale-100'}`} 
                        />
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-t from-[#0b0a1a] via-[#0b0a1a]/60 to-transparent transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                      
                      {/* Active Glow Effect */}
                      {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-[#b63cfa] blur-[60px] opacity-20 rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>}
                    </div>

                    {/* Content */}
                    <div className="relative z-10 p-4 h-full flex flex-col justify-center">
                      
                      {/* Top Row: Level Name & Badge */}
                      <div className={`flex items-center justify-between transition-all duration-500 z-10 ${isActive ? 'mb-auto' : ''}`}>
                        <span className={`font-black uppercase tracking-wider transition-all duration-500 truncate mr-2 ${isActive ? 'text-3xl text-white translate-y-2 text-shadow' : 'text-base text-gray-500 group-hover:text-gray-300'}`}>
                          {prize.name}
                        </span>
                        
                        {isActive && (
                          <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#b63cfa] to-[#573cfa] text-[10px] font-bold tracking-wider text-white shadow-lg animate-fade-in border border-white/10 whitespace-nowrap">
                            ACTIVE
                          </div>
                        )}
                        {!isActive && isCompleted && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold tracking-wider border border-green-500/20 whitespace-nowrap">
                            <span>DONE</span>
                          </div>
                        )}
                      </div>

                      {/* Active State Details (Description, Count, Progress) */}
                      <div className={`transition-all duration-500 delay-100 flex flex-col gap-3 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'}`}>
                         
                         {/* Prize Description */}
                         <div className="font-bold text-white text-xl leading-tight text-shadow-sm line-clamp-2">
                           {prize.description || prize.name}
                         </div>
                         
                         {/* Stats Row */}
                         <div className="flex items-center gap-3">
                            <span className={`font-mono font-bold text-sm ${prize.drawn >= prize.count ? "text-green-400" : "text-[#3c80fa]"}`}>
                              Qty: {prize.count - prize.drawn}
                            </span>
                            {/* Progress Bar */}
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${prize.drawn >= prize.count ? 'bg-green-500' : 'bg-gradient-to-r from-[#3c80fa] to-[#b63cfa]'}`}
                                style={{ width: `${(prize.drawn / prize.count) * 100}%` }}
                              ></div>
                            </div>
                         </div>
                      </div>
                      
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* 中间抽奖区 - Mobile Optimized */}
          <main className="flex-1 flex flex-col justify-center items-center relative min-h-0 overflow-hidden px-2 md:px-0">
            
            {/* 光环特效 */}
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] rounded-full bg-gradient-to-r from-[#3c80fa] via-[#b63cfa] to-[#573cfa] blur-[100px] opacity-10 transition-all duration-300 ${isRolling ? 'opacity-30 scale-110' : ''}`}></div>

            {/* 当前奖项提示 (Mobile Only: Floating top if needed, otherwise rely on sidebar active state) - Optional, kept standard */}
            {currentPrize && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pt-2 md:pt-0">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] md:text-sm shadow-xl backdrop-blur-md ${
                  isPrizeCompleted 
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-500/30' 
                    : 'bg-gradient-to-r from-[#b63cfa]/20 to-[#573cfa]/20 border-[#b63cfa]/30'
                }`}>
                  <span className={`font-bold ${isPrizeCompleted ? 'text-green-400' : 'text-[#b63cfa]'}`}>{currentPrize.name}</span>
                  {isPrizeCompleted ? (
                    <span className="text-green-300/70">✓ 已抽完 · 共 {currentPrize.count} 人</span>
                  ) : (
                    <span className="text-white/50">剩余 {currentPrize.count - currentPrize.drawn}</span>
                  )}
                </span>
              </div>
            )}
            
            {/* 动态网格/Flex容器 */}
            {showAllWinners && isPrizeCompleted && !isRolling ? (
              // 奖项已抽完且用户选择查看汇总 - 展示所有中奖者
              <div className="relative z-20 w-full max-w-6xl transition-all duration-500 flex-1 min-h-0 mt-8 md:mt-8 flex flex-col gap-2 md:gap-3 justify-center px-2 md:px-4 pb-2" style={{ maxHeight: '100%' }}>
                <div className="flex-1 overflow-y-auto w-full no-scrollbar flex flex-col justify-center">
                  {(() => {
                    const winners = getCurrentPrizeWinners();
                    const count = winners.length;
                    
                    // 使用布局算法计算最优布局
                    const { layoutConfig } = calculateSummaryLayout(count);
                    const { rows, style } = layoutConfig;
                    
                    let itemIndex = 0;
                    
                    // 渲染每一行
                    return rows.map((rowCount, rowIdx) => {
                      const rowWinners = winners.slice(itemIndex, itemIndex + rowCount);
                      itemIndex += rowCount;
                      
                      return (
                        <div key={`summary-row-${rowIdx}`} className="flex gap-2 md:gap-3 justify-center items-center w-full min-h-[min-content] my-1">
                          {rowWinners.map((winner, idx) => (
                            <div 
                              key={`winner-${winner.id}-${idx}`}
                              className={`relative overflow-hidden bg-gradient-to-br from-green-500/15 to-emerald-600/15 backdrop-blur-xl border border-green-500/30 rounded-xl md:rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_35px_rgba(34,197,94,0.35)] transition-all duration-300 hover:scale-[1.03] shrink-0 ${style.container} ${style.padding}`}
                            >
                              {/* Winner 标记 */}
                              <div className="absolute top-1 left-1 md:top-2 md:left-2 px-1.5 md:px-2 py-0.5 md:py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-md text-[7px] md:text-[9px] font-bold uppercase tracking-wider shadow-lg">
                                ★ Winner
                              </div>
                              
                              {/* 序号 */}
                              <div className="absolute top-1 right-1 md:top-2 md:right-2 px-1.5 md:px-2 py-0.5 bg-white/10 rounded-md text-[8px] md:text-[10px] font-bold text-white/60">
                                #{itemIndex - rowCount + idx + 1}
                              </div>
                              
                              {/* 头像 */}
                              <div className="mt-3 md:mt-5">
                                <img 
                                  src={winner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${winner.id}`} 
                                  alt="avatar" 
                                  className={`rounded-full object-cover shadow-xl border-2 md:border-4 border-green-500/60 ${style.avatar}`}
                                />
                              </div>
                              
                              {/* 信息 */}
                              <div className="text-center mt-1.5 md:mt-3 min-w-0 w-full px-1">
                                <h3 className={`font-black text-white truncate drop-shadow-md ${style.name}`}>
                                  {winner.name}
                                </h3>
                                <p className={`text-green-400/80 truncate font-medium mt-0.5 ${style.dept}`}>
                                  {winner.dept}
                                </p>
                                <p className={`text-gray-400 mt-0.5 ${style.id || 'text-[8px] md:text-[10px]'}`}>
                                  {winner.id}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : needsSpecialLayout(batchSize) ? (
              // 特殊布局：5人(3+2) 或 10人(5+5)
              <div className="relative z-20 w-full max-w-5xl transition-all duration-500 flex-1 min-h-0 mt-6 md:mt-8 flex flex-col gap-2 md:gap-3 justify-center" style={{ maxHeight: 'calc(100% - 60px)' }}>
                {(() => {
                  const rows = getSpecialLayoutRows(batchSize);
                  let itemIndex = 0;
                  
                  // 获取要显示的数据（placeholder 或 实际数据）
                  const displayItems = !hasDrawn && !isRolling 
                    ? Array.from({ length: batchSize }).map((_, i) => ({ placeholder: true, idx: i }))
                    : currentDisplay.map((user, i) => ({ placeholder: false, user, idx: i }));
                  
                  return rows.map((rowConfig, rowIdx) => {
                    const rowItemCount = rowConfig[0];
                    const rowItems = displayItems.slice(itemIndex, itemIndex + rowItemCount);
                    itemIndex += rowItemCount;
                    
                    return (
                      <div key={`row-${rowIdx}`} className="flex gap-2 md:gap-3 justify-center flex-1">
                        {rowItems.map((item) => {
                          if (item.placeholder) {
                            // 虚位以待卡片
                            return (
                              <div 
                                key={`placeholder-${item.idx}`}
                                className={`
                                  relative overflow-hidden bg-white/5 backdrop-blur-xl border border-dashed border-white/20 
                                  rounded-lg md:rounded-xl lg:rounded-2xl flex flex-col items-center justify-center 
                                  shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-all duration-300
                                  ${batchSize === 5 ? 'p-2 md:p-3 lg:p-4 flex-1 max-w-[180px] md:max-w-[220px] lg:max-w-[260px]' : 'p-1.5 md:p-2 lg:p-3 flex-1 max-w-[140px] md:max-w-[170px] lg:max-w-[200px]'}
                                `}
                              >
                                <div className="absolute top-0 right-0 p-1 md:p-2 opacity-30">
                                  <Grid size={12} />
                                </div>

                                <div className={`flex items-center ${cardStyle.layout}`}>
                                  <div className="relative shrink-0">
                                    <div className={`rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border-2 border-dashed border-white/20 ${cardStyle.avatar}`}>
                                      <HelpCircle className={`text-white/30 ${cardStyle.iconSize}`} />
                                    </div>
                                  </div>

                                  <div className="min-w-0 text-center">
                                    <h2 className={`font-black text-white/20 drop-shadow-md ${cardStyle.name}`}>
                                      虚位以待
                                    </h2>
                                    <p className={`font-light tracking-widest text-white/10 uppercase ${cardStyle.dept}`}>
                                      Waiting...
                                    </p>
                                  </div>
                                </div>

                                <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 px-1 md:px-1.5 py-0.5 bg-white/10 rounded text-[7px] md:text-[9px] font-bold text-white/30">
                                  #{item.idx + 1}
                                </div>
                              </div>
                            );
                          } else {
                            // 实际用户卡片
                            const user = (item as { placeholder: false; user: Participant; idx: number }).user;
                            return (
                              <div 
                                key={`${user.id}-${item.idx}`}
                                className={`
                                  relative overflow-hidden
                                  bg-white/5 backdrop-blur-xl border border-white/10 
                                  rounded-lg md:rounded-xl lg:rounded-2xl
                                  flex flex-col items-center justify-center
                                  shadow-[0_0_20px_rgba(0,0,0,0.3)]
                                  transition-all duration-300
                                  ${batchSize === 5 ? 'p-2 md:p-3 lg:p-4 flex-1 max-w-[180px] md:max-w-[220px] lg:max-w-[260px]' : 'p-1.5 md:p-2 lg:p-3 flex-1 max-w-[140px] md:max-w-[170px] lg:max-w-[200px]'}
                                  ${showConfetti ? 'ring-2 ring-[#b63cfa] scale-[1.01] shadow-[0_0_30px_rgba(182,60,250,0.3)]' : ''}
                                `}
                              >
                                <div className="absolute top-0 right-0 p-1 md:p-2 opacity-30">
                                  <Grid size={12} />
                                </div>

                                <div className={`flex items-center ${cardStyle.layout}`}>
                                  <div className="relative group shrink-0">
                                    {isRolling && <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#3c80fa] to-[#b63cfa] blur-md animate-spin"></div>}
                                    <img 
                                      src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                                      alt="avatar" 
                                      className={`
                                        relative rounded-full object-cover shadow-2xl transition-all
                                        ${cardStyle.avatar}
                                        ${isRolling ? 'border-white/20 scale-95' : 'border-[#b63cfa] scale-100'}
                                      `}
                                    />
                                  </div>

                                  <div className="min-w-0 text-center">
                                    <h2 className={`
                                      font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-md truncate
                                      ${cardStyle.name}
                                      ${isRolling ? 'blur-[1px]' : ''}
                                    `}>
                                      {user.name}
                                    </h2>
                                    <p className={`font-light tracking-widest text-[#3c80fa] uppercase truncate ${cardStyle.dept}`}>
                                      {user.dept}
                                    </p>
                                    {showConfetti && (
                                      <p className="text-gray-500 mt-0.5 text-[8px] md:text-[10px]">
                                        工号: {user.id}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {showConfetti && (
                                  <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 px-1 md:px-1.5 py-0.5 bg-[#b63cfa] rounded text-[6px] md:text-[8px] font-bold uppercase tracking-wider animate-bounce">
                                    Winner
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              // 常规网格布局：1, 2, 4, 9, 16人
              <div className={`
                relative z-20 w-full max-w-5xl transition-all duration-500
                grid gap-2 md:gap-3
                flex-1 min-h-0 mt-6 md:mt-8
                ${getGridClass(batchSize)}
              `}
              style={{ maxHeight: 'calc(100% - 60px)' }}
              >
              
              {/* 根据是否已抽奖来决定显示内容 */}
              {!hasDrawn && !isRolling ? (
                // 虚位以待状态
                Array.from({ length: batchSize }).map((_, idx) => (
                  <div 
                    key={`placeholder-${idx}`}
                    className={`
                      relative overflow-hidden bg-white/5 backdrop-blur-xl border border-dashed border-white/20 
                      rounded-lg md:rounded-xl lg:rounded-2xl flex flex-col items-center justify-center 
                      shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-all duration-300
                      ${batchSize === 1 ? 'p-4 md:p-6 lg:p-8' : batchSize === 4 ? 'p-3 md:p-4 lg:p-5' : batchSize === 9 ? 'p-2 md:p-3' : 'p-1.5 md:p-2'}
                    `}
                  >
                    <div className="absolute top-0 right-0 p-1 md:p-2 opacity-30">
                      <Grid size={batchSize >= 9 ? 10 : batchSize >= 4 ? 12 : 16} />
                    </div>

                    <div className={`flex items-center ${cardStyle.layout}`}>
                      <div className="relative shrink-0">
                        <div className={`rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border-2 border-dashed border-white/20 ${cardStyle.avatar}`}>
                          <HelpCircle className={`text-white/30 ${cardStyle.iconSize}`} />
                        </div>
                      </div>

                      <div className={`min-w-0 ${batchSize === 1 ? 'text-center md:text-left' : 'text-center'}`}>
                        <h2 className={`font-black text-white/20 drop-shadow-md ${cardStyle.name}`}>
                          {batchSize >= 16 ? '?' : '虚位以待'}
                        </h2>
                        {batchSize < 16 && (
                          <p className={`font-light tracking-widest text-white/10 uppercase ${cardStyle.dept}`}>
                            Waiting...
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={`absolute top-0.5 left-0.5 md:top-1 md:left-1 px-1 md:px-1.5 py-0.5 bg-white/10 rounded text-[7px] md:text-[9px] font-bold text-white/30 ${batchSize >= 16 ? 'hidden md:block' : ''}`}>
                      #{idx + 1}
                    </div>
                  </div>
                ))
              ) : (
                // 正常显示用户卡片
                currentDisplay.map((user, idx) => (
                  <div 
                    key={`${user.id}-${idx}`}
                    className={`
                      relative overflow-hidden
                      bg-white/5 backdrop-blur-xl border border-white/10 
                      rounded-lg md:rounded-xl lg:rounded-2xl
                      flex flex-col items-center justify-center
                      shadow-[0_0_20px_rgba(0,0,0,0.3)]
                      transition-all duration-300
                      ${batchSize === 1 ? 'p-4 md:p-6 lg:p-8' : batchSize === 4 ? 'p-3 md:p-4 lg:p-5' : batchSize === 9 ? 'p-2 md:p-3' : 'p-1.5 md:p-2'}
                      ${showConfetti ? 'ring-2 ring-[#b63cfa] scale-[1.01] shadow-[0_0_30px_rgba(182,60,250,0.3)]' : ''}
                    `}
                  >
                    <div className="absolute top-0 right-0 p-1 md:p-2 opacity-30">
                      <Grid size={batchSize >= 9 ? 10 : batchSize >= 4 ? 12 : 16} />
                    </div>

                    <div className={`flex items-center ${cardStyle.layout}`}>
                      <div className="relative group shrink-0">
                         {isRolling && <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#3c80fa] to-[#b63cfa] blur-md animate-spin"></div>}
                         <img 
                          src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                          alt="avatar" 
                          className={`
                            relative rounded-full object-cover shadow-2xl transition-all
                            ${cardStyle.avatar}
                            ${isRolling ? 'border-white/20 scale-95' : 'border-[#b63cfa] scale-100'}
                          `}
                        />
                      </div>

                      <div className={`min-w-0 ${batchSize === 1 ? 'text-center md:text-left' : 'text-center'}`}>
                        <h2 className={`
                          font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 drop-shadow-md truncate
                          ${cardStyle.name}
                          ${isRolling ? 'blur-[1px]' : ''}
                        `}>
                          {user.name}
                        </h2>
                        <p className={`font-light tracking-widest text-[#3c80fa] uppercase truncate ${cardStyle.dept}`}>
                          {user.dept}
                        </p>
                        {showConfetti && batchSize < 16 && (
                          <p className={`text-gray-500 mt-0.5 ${batchSize >= 9 ? 'text-[8px] md:text-[10px]' : 'text-[10px] md:text-xs'}`}>
                            工号: {user.id}
                          </p>
                        )}
                      </div>
                    </div>

                    {showConfetti && (
                       <div className={`absolute top-0.5 left-0.5 md:top-1 md:left-1 px-1 md:px-1.5 py-0.5 bg-[#b63cfa] rounded text-[6px] md:text-[8px] font-bold uppercase tracking-wider animate-bounce ${batchSize >= 16 ? 'hidden md:block' : ''}`}>
                         Winner
                       </div>
                    )}
                  </div>
                ))
              )}
            </div>
            )}

          {/* 启动按钮区域 */}
          <div className="mt-4 md:mt-6 z-30 shrink-0 flex items-center justify-center gap-2 md:gap-3">
            {/* Mobile: 奖项切换按钮 - 与主按钮水平对齐 */}
            <button
              onClick={() => setMobilePrizeSidebarOpen(true)}
              className={`
                md:hidden
                px-3 py-2 rounded-full font-bold
                transition-all duration-300 transform hover:scale-105 active:scale-95
                shadow-[0_4px_20px_rgba(0,0,0,0.3)]
                bg-gradient-to-r from-[#b63cfa]/80 to-[#573cfa]/80 backdrop-blur-sm text-white border border-white/20 hover:border-[#b63cfa]/50
                flex items-center gap-1.5
                ${isRolling ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <Gift size={14} />
              <span className="text-xs max-w-[60px] truncate">{currentPrize?.name || '奖项'}</span>
              {currentPrize && (
                <span className="px-1 py-0.5 rounded-full bg-white/20 text-[8px] font-bold min-w-[16px] text-center">
                  {currentPrize.count - currentPrize.drawn}
                </span>
              )}
            </button>
            {/* 当正在查看汇总页时，显示"返回"按钮 */}
            {showAllWinners && isPrizeCompleted && (
              <button
                onClick={() => setShowAllWinners(false)}
                className="px-3 py-2 md:px-10 md:py-4 rounded-full font-bold text-xs md:text-xl tracking-wider
                  transition-all duration-300 transform hover:scale-105 active:scale-95
                  shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
                  bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20
                  whitespace-nowrap"
              >
                ← 返回
              </button>
            )}
            
            {/* 主按钮 */}
            <button
              onClick={() => {
                if (isPrizeCompleted && !showAllWinners) {
                  // 奖项已完成但没在看汇总页 -> 显示汇总页
                  setShowAllWinners(true);
                } else {
                  // 正常抽奖逻辑
                  toggleLottery();
                }
              }}
              disabled={!currentPrize || (showAllWinners && isPrizeCompleted)}
              className={`
                group relative px-5 py-2 md:px-14 md:py-4 rounded-full font-bold text-sm md:text-2xl tracking-wider md:tracking-widest uppercase
                transition-all duration-300 transform hover:scale-105 active:scale-95
                shadow-[0_8px_30px_rgba(0,0,0,0.5)] md:shadow-[0_10px_40px_rgba(0,0,0,0.6)]
                overflow-hidden whitespace-nowrap
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${isRolling 
                  ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white ring-2 md:ring-4 ring-red-500/30' 
                  : isPrizeCompleted && !showAllWinners
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white ring-2 md:ring-4 ring-green-500/30'
                    : 'bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white ring-2 md:ring-4 ring-[#3c80fa]/30'
                }
              `}
            >
              <span className="relative z-10 flex items-center gap-1.5 md:gap-3">
                {isRolling ? (
                  <>
                    <Square fill="currentColor" size={16} className="md:w-5 md:h-5"/>
                    <span>STOP</span>
                  </>
                ) : isPrizeCompleted && !showAllWinners ? (
                  <>
                    <Trophy size={16} className="md:w-5 md:h-5"/>
                    <span>查看{currentPrize?.count}人</span>
                  </>
                ) : showAllWinners ? (
                  <>
                    <Trophy size={16} className="md:w-5 md:h-5"/>
                    <span>已抽完</span>
                  </>
                ) : (
                  <>
                    <Play fill="currentColor" size={16} className="md:w-5 md:h-5"/>
                    <span>抽{batchSize}人</span>
                  </>
                )}
              </span>
              <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shiny" />
            </button>
          </div>
            </main>
        </div>

        {/* 3. 底部：中奖名单走马灯 */}
        <footer className="w-full h-12 md:h-14 mt-2 relative rounded-lg md:rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden flex flex-col justify-center shrink-0">
          <div className="absolute top-1 md:top-1.5 left-3 md:left-4 text-[8px] md:text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-[#b63cfa] animate-pulse"></div>
             最新中奖
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto px-3 md:px-4 pt-2.5 md:pt-2 no-scrollbar scroll-smooth h-full">
            {recentWinners.length === 0 ? (
              <div className="w-full text-center text-gray-600 italic text-[10px] md:text-xs">等待抽奖...</div>
            ) : (
              recentWinners.map((winner, idx) => (
                <div key={`${winner.id}-${idx}`} className="flex-shrink-0 flex items-center gap-1 bg-black/30 pr-2 pl-1 py-0.5 rounded-full border border-white/5">
                  <img src={winner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${winner.id}`} className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-[#b63cfa]" alt="" />
                  <span className="text-white font-bold text-[8px] md:text-[10px]">{winner.name}</span>
                </div>
              ))
            )}
          </div>
        </footer>

      </div>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        participants={participants}
        onParticipantsChange={setParticipants}
        prizes={prizes}
        onPrizesChange={setPrizes}
        records={records}
        onRecordsChange={setRecords}
        onUndoRecord={handleUndoRecord}
        onClearAll={handleClearAll}
        onOpenCheckInDisplay={onOpenCheckInDisplay}
        backgroundMusic={backgroundMusic}
        onBackgroundMusicChange={setBackgroundMusic}
      />
    </div>
  );
};

export default App;
