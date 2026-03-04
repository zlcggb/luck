import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Play,
  Eye,
  Loader2,
  Settings,
  X,
  Copy,
  Download,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  LuckEvent,
  getEvent,
  getPrizes,
  getParticipants,
  createPrize,
  updatePrize as updatePrizeApi,
  deletePrize as deletePrizeApi
} from '../utils/supabaseCheckin';
import { Participant, Prize, DrawRecord, BackgroundMusicSettings, DEFAULT_BACKGROUND_MUSIC, ThemeId, ThemePalette, AvatarThemeId } from '../types';
import SettingsPanel from '../components/SettingsPanel';
import {
  saveParticipants,
  savePrizes,
  loadPrizes,
  saveRecords,
  loadRecords,
} from '../utils/storage';
import {
  loadProjectSettings,
  getThemeIdFromSettings,
  getCustomThemePaletteFromSettings,
  getAvatarThemeIdFromSettings,
  getBackgroundMusicFromSettings,
  saveProjectSettings,
} from '../utils/projectSettings';
import { DEFAULT_CUSTOM_THEME, DEFAULT_THEME_ID, getThemeById, paletteToCssVariables } from '../theme';
import { DEFAULT_AVATAR_THEME_ID } from '../avatarTheme';

/**
 * 项目设置页面 - 嵌入原有设置面板
 */
const ProjectSettingsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<LuckEvent | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement | null>(null);
  
  // 本地状态（用于 SettingsPanel）
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [records, setRecords] = useState<DrawRecord[]>([]);
  const [backgroundMusic, setBackgroundMusic] = useState<BackgroundMusicSettings>(DEFAULT_BACKGROUND_MUSIC);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [customThemePalette, setCustomThemePalette] = useState<ThemePalette>(DEFAULT_CUSTOM_THEME);
  const [avatarThemeId, setAvatarThemeId] = useState<AvatarThemeId>(DEFAULT_AVATAR_THEME_ID);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 标记是否已从数据库初始化设置（防止初始值触发保存）
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // 防抖 timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化
  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // 设置变更时同步到数据库（防抖 800ms）
  useEffect(() => {
    if (!settingsLoaded || !projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProjectSettings(projectId, {
        themeId,
        customThemePalette,
        avatarThemeId,
        backgroundMusic,
      });
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [themeId, customThemePalette, avatarThemeId, backgroundMusic, settingsLoaded, projectId]);

  useEffect(() => {
    if (backgroundMusic.src) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsMusicPlaying(false);
    }
  }, [backgroundMusic.src]);

  // 加载项目数据
  const loadProject = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      // 加载项目信息
      const projectData = await getEvent(projectId);
      if (!projectData) {
        alert('项目不存在');
        navigate('/projects');
        return;
      }
      setProject(projectData);
      
      // 从数据库 settings 字段加载项目级配置
      const dbSettings = await loadProjectSettings(projectId);
      if (dbSettings) {
        setThemeId(getThemeIdFromSettings(dbSettings));
        setCustomThemePalette(getCustomThemePaletteFromSettings(dbSettings));
        setAvatarThemeId(getAvatarThemeIdFromSettings(dbSettings));
        setBackgroundMusic(getBackgroundMusicFromSettings(dbSettings));
      }
      // 标记设置已加载，后续变更才触发同步
      setSettingsLoaded(true);
      
      // 加载参与者
      const participantList = await getParticipants(projectId);
      const localParticipants: Participant[] = participantList.map(p => ({
        id: p.employee_id,
        name: p.name,
        dept: p.department || '',
        avatar: p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.employee_id}`
      }));
      setParticipants(localParticipants);
      saveParticipants(localParticipants);
      
      // 加载奖项
      const prizeList = await getPrizes(projectId);
      if (prizeList.length > 0) {
        // 数据库中有奖项，转换格式
        const localPrizes: Prize[] = prizeList.map(p => ({
          id: p.id,
          name: p.name,
          count: p.quantity,
          description: p.description || '',
          drawn: p.quantity - p.remaining,
          image: p.image || undefined
        }));
        setPrizes(localPrizes);
        savePrizes(localPrizes);
      } else {
        // 数据库中没有奖项，使用本地或创建默认
        const localPrizes = loadPrizes();
        if (localPrizes.length > 0) {
          setPrizes(localPrizes);
        } else {
          // 创建默认奖项
          const defaultPrizes: Prize[] = [
            { id: 'prize_1', name: '特等奖', count: 1, description: 'iPhone 15 Pro Max', drawn: 0 },
            { id: 'prize_2', name: '一等奖', count: 3, description: 'MacBook Pro', drawn: 0 },
            { id: 'prize_3', name: '二等奖', count: 5, description: 'iPad Air', drawn: 0 },
            { id: 'prize_4', name: '三等奖', count: 10, description: 'AirPods Pro', drawn: 0 },
          ];
          setPrizes(defaultPrizes);
          savePrizes(defaultPrizes);
          
          // 同步到数据库
          for (const prize of defaultPrizes) {
            await createPrize(projectId, {
              name: prize.name,
              description: prize.description,
              quantity: prize.count,
              sort_order: defaultPrizes.indexOf(prize)
            });
          }
        }
      }
      
      // 加载抽奖记录
      const localRecords = loadRecords();
      setRecords(localRecords);
      
    } catch (error) {
      console.error('加载项目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理参与者变化 - 保存到本地和数据库
  const handleParticipantsChange = (newParticipants: Participant[]) => {
    setParticipants(newParticipants);
    saveParticipants(newParticipants);
  };

  // 处理奖项变化 - 保存到本地和数据库
  const handlePrizesChange = async (newPrizes: Prize[]) => {
    if (!projectId) return;
    
    setPrizes(newPrizes);
    savePrizes(newPrizes);
    
    // 同步到数据库
    try {
      // 简单策略：更新所有奖项
      for (const prize of newPrizes) {
        const dbPrizes = await getPrizes(projectId);
        const existingPrize = dbPrizes.find(p => p.id === prize.id);
        
        if (existingPrize) {
          // 更新现有奖项
          await updatePrizeApi(prize.id, {
            name: prize.name,
            description: prize.description || null,
            image: prize.image || null,
            quantity: prize.count,
            remaining: prize.count - prize.drawn
          });
        } else {
          // 创建新奖项
          await createPrize(projectId, {
            name: prize.name,
            description: prize.description,
            image: prize.image,
            quantity: prize.count
          });
        }
      }
      
      // 删除多余的奖项（数据库中有但本地没有的）
      const dbPrizes = await getPrizes(projectId);
      for (const dbPrize of dbPrizes) {
        if (!newPrizes.find(p => p.id === dbPrize.id)) {
          await deletePrizeApi(dbPrize.id);
        }
      }
    } catch (error) {
      console.error('同步奖项到数据库失败:', error);
    }
  };

  // 处理记录变化
  const handleRecordsChange = (newRecords: DrawRecord[]) => {
    setRecords(newRecords);
    saveRecords(newRecords);
  };

  // 撤销记录
  const handleUndoRecord = (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;
    
    // 从已中奖集合中移除
    const newRecords = records.filter(r => r.id !== recordId);
    setRecords(newRecords);
    saveRecords(newRecords);
    
    // 更新奖项已抽取数量
    const newPrizes = prizes.map(p =>
      p.id === record.prizeId
        ? { ...p, drawn: Math.max(0, p.drawn - record.winners.length) }
        : p
    );
    setPrizes(newPrizes);
    savePrizes(newPrizes);
  };

  // 清除所有数据
  const handleClearAll = () => {
    setParticipants([]);
    setPrizes([]);
    setRecords([]);
    setAvatarThemeId(DEFAULT_AVATAR_THEME_ID);
    saveParticipants([]);
    savePrizes([]);
    saveRecords([]);
  };

  const activePalette = themeId === 'custom'
    ? customThemePalette
    : getThemeById(themeId).palette;
  const themeStyle = paletteToCssVariables(activePalette) as unknown as CSSProperties;

  if (loading) {
    return (
      <div data-theme={themeId} style={themeStyle} className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div data-theme={themeId} style={themeStyle} className="min-h-screen bg-[var(--color-bg-base)] flex flex-col items-center justify-center text-white">
        <p className="text-xl mb-4">项目不存在</p>
        <button onClick={() => navigate('/projects')} className="text-blue-400 hover:underline">
          返回项目列表
        </button>
      </div>
    );
  }

  return (
    <div data-theme={themeId} style={themeStyle} className="min-h-screen bg-[var(--color-bg-base)] text-white">
      <audio
        ref={audioRef}
        src={backgroundMusic.src || undefined}
        loop
        preload="auto"
        className="hidden"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
      />
      {/* 沉浸式背景 */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/20 filter blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-600/15 filter blur-[150px]" />
        <div className="absolute inset-0 bg-black/40 apple-gradient-mask" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                <Sparkles size={20} className="text-blue-400" />
                {project.name}
                <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  (project as any).mode === 'rolling'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {(project as any).mode === 'rolling' ? '轮动式' : '转盘式'}
                </span>
              </h1>
              <p className="text-[11px] font-bold tracking-widest text-white/50 uppercase mt-1">
                {(project as any).mode === 'rolling' ? 'ROLLING LOTTERY' : 'WHEEL LOTTERY'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {(project as any).mode === 'rolling' ? (
              /* 轮动式顶部按钮 */
              <>
                <button
                  onClick={() => setSettingsPanelOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 apple-glass hover:bg-white/10 rounded-2xl transition-all text-sm font-semibold tracking-wide"
                >
                  <Settings size={18} />
                  <span className="hidden sm:inline">设置</span>
                </button>
                <button
                  onClick={() => window.open(`/lottery?event=${projectId}&mode=admin`, '_blank')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-2xl font-bold tracking-wide hover:shadow-[0_4px_30px_rgba(255,255,255,0.4)] transition-all active:scale-[0.98]"
                >
                  <Play size={18} />
                  <span className="hidden sm:inline">大屏开奖</span>
                </button>
                <button
                  onClick={() => window.open(`/display?event=${projectId}`, '_blank')}
                  className="flex items-center gap-2 px-5 py-2.5 apple-glass hover:bg-white/10 rounded-2xl font-semibold tracking-wide transition-all active:scale-[0.98]"
                >
                  <Eye size={18} />
                  <span className="hidden sm:inline">签到一览</span>
                </button>
              </>
            ) : (
              /* 转盘式顶部按钮 */
              <>
                <button
                  onClick={() => window.open(`/lottery/wheel?event=${projectId}`, '_blank')}
                  className="flex items-center gap-2 px-5 py-2.5 apple-glass hover:bg-white/10 rounded-2xl transition-all text-sm font-semibold tracking-wide"
                >
                  <Eye size={18} />
                  <span className="hidden sm:inline">预览抽奖</span>
                </button>
                <button
                  onClick={() => window.open(`/lottery/wheel/admin?event=${projectId}&mode=admin`, '_blank')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-2xl font-bold tracking-wide hover:shadow-[0_4px_30px_rgba(255,255,255,0.4)] transition-all active:scale-[0.98]"
                >
                  <Play size={18} />
                  <span className="hidden sm:inline">管理后台</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 项目信息卡片 */}
          <div className="apple-glass rounded-[32px] p-8 flex flex-col justify-between">
            <h3 className="text-lg font-bold mb-6 tracking-tight">项目信息</h3>
            <div className="space-y-4 text-[15px]">
              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-1">PROJECT NAME</p>
                <p className="text-white font-semibold">{project.name}</p>
              </div>
              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-1">EVENT DATE</p>
                <p className="text-white font-semibold">{new Date(project.event_date).toLocaleDateString('zh-CN')}</p>
              </div>
              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-1">MODE</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                  (project as any).mode === 'rolling'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {(project as any).mode === 'rolling' ? 'ROLLING' : 'WHEEL'}
                </span>
              </div>
              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-1">STATUS</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                  project.status === 'active' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  project.status === 'completed' ? 'bg-white/10 text-white/60 border border-white/20' :
                  'bg-white/10 text-white/60 border border-white/20'
                }`}>
                  {project.status === 'active' ? 'ACTIVE' : project.status === 'completed' ? 'COMPLETED' : 'DRAFT'}
                </span>
              </div>
            </div>
          </div>

          {/* 参与者统计 */}
          <div className="apple-glass rounded-[32px] p-8 flex flex-col items-center justify-center text-center">
            <h3 className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-6 drop-shadow-sm">TOTAL PARTICIPANTS</h3>
            <p className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-blue-400 to-indigo-500 mb-2 drop-shadow-[0_0_20px_rgba(96,165,250,0.4)]">
              {participants.length}
            </p>
            <p className="text-white/50 text-sm font-semibold tracking-wide mt-2">已登记数据</p>
          </div>

          {/* 奖项统计 */}
          <div className="apple-glass rounded-[32px] p-8 flex flex-col items-center justify-center text-center">
            <h3 className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-6 drop-shadow-sm">PRIZE TIERS</h3>
            <p className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-purple-400 to-pink-500 mb-2 drop-shadow-[0_0_20px_rgba(192,132,252,0.4)]">
              {prizes.length}
            </p>
            <p className="text-white/50 text-sm font-semibold tracking-wide mt-2">设定的奖项数</p>
          </div>
        </div>

        {/* 快速操作 — 严格按模式分离 */}
        <div className="mt-8 apple-glass rounded-[32px] p-8">
          <h3 className="text-lg font-bold mb-6 tracking-tight">操作导航</h3>
          
          {(project as any).mode === 'rolling' ? (
            /* ── 轮动式操作面板 ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <button
                onClick={() => setSettingsPanelOpen(true)}
                className="p-6 apple-glass hover:bg-white/10 rounded-3xl transition-all text-left group"
              >
                <p className="font-bold text-[17px] mb-2 group-hover:text-blue-400 transition-colors">展会设置</p>
                <p className="text-xs text-white/50 tracking-wide leading-relaxed">配置活动参数、参与者名单与主题风格</p>
              </button>
              <button
                onClick={() => setSettingsPanelOpen(true)}
                className="p-6 apple-glass hover:bg-white/10 rounded-3xl transition-all text-left group"
              >
                <p className="font-bold text-[17px] mb-2 group-hover:text-blue-400 transition-colors">配置奖项</p>
                <p className="text-xs text-white/50 tracking-wide leading-relaxed">管理并控制所有奖品库存状态</p>
              </button>
              <button
                onClick={() => window.open(`/lottery?event=${projectId}&mode=admin`, '_blank')}
                className="p-6 bg-white hover:bg-gray-100 rounded-3xl border border-white/10 transition-all text-left group shadow-[0_4px_30px_rgba(255,255,255,0.25)]"
              >
                <p className="font-bold text-[17px] text-black mb-2">🎲 大屏开奖</p>
                <p className="text-xs text-gray-600 font-medium tracking-wide leading-relaxed">全屏演示模式下的轮动式抽奖</p>
              </button>
              <button
                onClick={() => window.open(`/display?event=${projectId}`, '_blank')}
                className="p-6 apple-glass hover:bg-white/10 rounded-3xl transition-all text-left group"
              >
                <p className="font-bold text-[17px] mb-2 group-hover:text-amber-400 transition-colors">签到看板</p>
                <p className="text-xs text-white/50 tracking-wide leading-relaxed">实时监测访客扫码登记状态及人流情况</p>
              </button>
            </div>
          ) : (
            /* ── 转盘式操作面板 ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <button
                onClick={() => window.open(`/lottery/wheel?event=${projectId}`, '_blank')}
                className="p-6 bg-white hover:bg-gray-100 rounded-3xl border border-white/10 transition-all text-left group shadow-[0_4px_30px_rgba(255,255,255,0.25)]"
              >
                <p className="font-bold text-[17px] text-black mb-2">🎰 预览转盘</p>
                <p className="text-xs text-gray-600 font-medium tracking-wide leading-relaxed">查看用户扫码后看到的转盘抽奖页面</p>
              </button>
              <button
                onClick={() => window.open(`/lottery/wheel/admin?event=${projectId}&mode=admin`, '_blank')}
                className="p-6 apple-glass hover:bg-white/10 rounded-3xl transition-all text-left group border border-blue-500/20"
              >
                <p className="font-bold text-[17px] mb-2 group-hover:text-blue-400 transition-colors">📊 管理后台</p>
                <p className="text-xs text-white/50 tracking-wide leading-relaxed">中奖记录、核销凭证、奖品库存管理</p>
              </button>
              <button
                onClick={() => setShowLinkModal(true)}
                className="p-6 apple-glass hover:bg-white/10 rounded-3xl transition-all text-left group"
              >
                <p className="font-bold text-[17px] mb-2 group-hover:text-green-400 transition-colors">📱 二维码 & 链接</p>
                <p className="text-xs text-white/50 tracking-wide leading-relaxed">生成二维码供访客扫码参与抽奖</p>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        participants={participants}
        onParticipantsChange={handleParticipantsChange}
        prizes={prizes}
        onPrizesChange={handlePrizesChange}
        records={records}
        onRecordsChange={handleRecordsChange}
        onUndoRecord={handleUndoRecord}
        onClearAll={handleClearAll}
        onOpenCheckInDisplay={() => navigate(`/display?event=${projectId}`)}
        currentEventId={projectId}
        onEventChange={(newEventId) => navigate(`/project/${newEventId}`)}
        themeId={themeId}
        onThemeChange={setThemeId}
        customThemePalette={customThemePalette}
        onCustomThemePaletteChange={setCustomThemePalette}
        avatarThemeId={avatarThemeId}
        onAvatarThemeChange={setAvatarThemeId}
        backgroundMusic={backgroundMusic}
        onBackgroundMusicChange={setBackgroundMusic}
        isMusicPlaying={isMusicPlaying}
        onToggleMusic={() => {
          if (!audioRef.current || !backgroundMusic.src) return;
          if (audioRef.current.paused) {
            audioRef.current.play().catch(() => null);
          } else {
            audioRef.current.pause();
          }
        }}
      />
      {/* 二维码 & 链接弹窗 */}
      {showLinkModal && (() => {
        const lotteryUrl = `${window.location.origin}/lottery/wheel?event=${projectId}`;

        const handleCopy = () => {
          navigator.clipboard.writeText(lotteryUrl);
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
        };

        const handleDownloadQR = () => {
          if (!qrRef.current) return;
          const svg = qrRef.current.querySelector('svg');
          if (!svg) return;
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
            canvas.width = 1024;
            canvas.height = 1024;
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, 1024, 1024);
              ctx.drawImage(img, 0, 0, 1024, 1024);
            }
            const a = document.createElement('a');
            a.download = `${project?.name || 'lottery'}_qrcode.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
          };
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4"
            onClick={() => setShowLinkModal(false)}
          >
            <div
              className="apple-glass-dark border border-white/15 rounded-[32px] p-8 w-full max-w-md shadow-[0_20px_80px_rgba(0,0,0,0.6)] transform animate-bounceIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={() => setShowLinkModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-bold tracking-tight mb-1">分享抽奖入口</h3>
              <p className="text-[13px] text-white/50 tracking-wide mb-8">访客扫描二维码或点击链接即可参与抽奖</p>

              {/* QR 码 */}
              <div className="flex justify-center mb-8" ref={qrRef}>
                <div className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                  <QRCodeSVG
                    value={lotteryUrl}
                    size={220}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#1a1a2e"
                  />
                </div>
              </div>

              {/* 链接展示 */}
              <div className="bg-black/40 rounded-2xl p-4 border border-white/10 mb-6">
                <p className="text-[10px] text-white/40 font-bold tracking-widest uppercase mb-2">LOTTERY URL</p>
                <p className="text-[13px] text-white/80 font-mono break-all leading-relaxed select-all">{lotteryUrl}</p>
              </div>

              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopy}
                  className={`py-3.5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    linkCopied
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'apple-glass hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {linkCopied ? <Check size={18} /> : <Copy size={18} />}
                  {linkCopied ? '已复制' : '复制链接'}
                </button>
                <button
                  onClick={handleDownloadQR}
                  className="py-3.5 bg-white text-black hover:bg-gray-100 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Download size={18} />
                  保存二维码
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ProjectSettingsPage;
