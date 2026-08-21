import { useState, useEffect, useRef } from 'react';
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
  Check,
  QrCode,
  UsersRound,
  Gift,
  CalendarDays,
  SlidersHorizontal,
  MonitorUp,
  UserCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  LuckEvent,
  getEvent,
  getPrizes,
  getParticipants,
  createPrize,
  initDefaultRollingPrizes,
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
import { DEFAULT_CUSTOM_THEME, DEFAULT_THEME_ID } from '../theme';
import { DEFAULT_AVATAR_THEME_ID } from '../avatarTheme';
import MobileBottomNav from '../components/navigation/MobileBottomNav';
import { useUiAppearance } from '../contexts/UiAppearanceContext';
import { rememberLastProject } from '../utils/mobileNavigation';

/**
 * 项目设置页面 - 嵌入原有设置面板
 */
const ProjectSettingsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { appearance } = useUiAppearance();
  
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
      rememberLastProject(projectId);
      
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
          const createdPrizes = await initDefaultRollingPrizes(projectId);
          if (createdPrizes.length > 0) {
            const localPrizes: Prize[] = createdPrizes.map(p => ({
              id: p.id,
              name: p.name,
              count: p.quantity,
              description: p.description || '',
              drawn: p.quantity - p.remaining,
              image: p.image || undefined
            }));
            setPrizes(localPrizes);
            savePrizes(localPrizes);
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

      // 同步完成后从数据库重新拉取带正确 UUID 的奖项
      const updatedDbPrizes = await getPrizes(projectId);
      const syncedPrizes: Prize[] = updatedDbPrizes.map(p => ({
        id: p.id,
        name: p.name,
        count: p.quantity,
        description: p.description || '',
        drawn: p.quantity - p.remaining,
        image: p.image || undefined,
      }));
      setPrizes(syncedPrizes);
      savePrizes(syncedPrizes);
    } catch (error) {
      console.error('同步奖项到数据库失败:', error);
      setPrizes(newPrizes);
      savePrizes(newPrizes);
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

  if (loading) {
    return (
      <div className="vip-ui admin-ui flex min-h-screen items-center justify-center" data-ui-theme={appearance}>
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="vip-ui admin-ui flex min-h-screen flex-col items-center justify-center" data-ui-theme={appearance}>
        <p className="text-xl mb-4">项目不存在</p>
        <button onClick={() => navigate('/projects')} className="text-blue-400 hover:underline">
          返回项目列表
        </button>
      </div>
    );
  }

  return (
    <div className="vip-ui admin-ui min-h-screen" data-ui-theme={appearance}>
      <audio
        ref={audioRef}
        src={backgroundMusic.src || undefined}
        loop
        preload="auto"
        className="hidden"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
      />
      {/* Header */}
      <header className="vip-glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              aria-label="返回项目列表"
              title="返回项目列表"
              className="vip-icon-button grid w-11 place-items-center transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                <Sparkles size={20} className="text-blue-400" />
                {project.name}
                <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  (project as any).mode === 'rolling'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {(project as any).mode === 'rolling' ? '轮动式' : '转盘式'}
                </span>
              </h1>
              <p className="text-[11px] font-bold tracking-widest text-white/50 uppercase mt-1">
                {(project as any).mode === 'rolling' ? 'ROLLING LOTTERY' : 'WHEEL LOTTERY'}
              </p>
            </div>
          </div>
          
          <div className="hidden items-center gap-3 sm:flex">
            {(project as any).mode === 'rolling' ? (
              /* 轮动式顶部按钮 */
              <>
                <button
                  onClick={() => setSettingsPanelOpen(true)}
                  aria-label="打开项目设置"
                  title="打开项目设置"
                  className="vip-button-secondary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold tracking-wide"
                >
                  <Settings size={18} />
                  <span className="hidden sm:inline">设置</span>
                </button>
                <button
                  onClick={() => window.open(`/lottery?event=${projectId}&mode=admin`, '_blank')}
                  aria-label="打开大屏开奖"
                  title="打开大屏开奖"
                  className="vip-button-primary flex items-center gap-2 px-5 py-2.5 font-bold tracking-wide"
                >
                  <Play size={18} />
                  <span className="hidden sm:inline">大屏开奖</span>
                </button>
                <button
                  onClick={() => window.open(`/display?event=${projectId}`, '_blank')}
                  aria-label="打开签到一览"
                  title="打开签到一览"
                  className="vip-button-secondary flex items-center gap-2 px-5 py-2.5 font-semibold tracking-wide"
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
                  aria-label="预览转盘抽奖"
                  title="预览转盘抽奖"
                  className="vip-button-secondary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold tracking-wide"
                >
                  <Eye size={18} />
                  <span className="hidden sm:inline">预览抽奖</span>
                </button>
                <button
                  onClick={() => window.open(`/lottery/wheel/admin?event=${projectId}&mode=admin`, '_blank')}
                  aria-label="打开转盘管理后台"
                  title="打开转盘管理后台"
                  className="vip-button-primary flex items-center gap-2 px-5 py-2.5 font-bold tracking-wide"
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
      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:pb-16">
        <div className="mb-6">
          <p className="text-sm font-medium text-[#2563eb]">项目工作台</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#111827]">概览与快捷操作</h2>
          <p className="mt-2 text-sm text-[#6b7280]">管理活动配置、签到数据和开奖入口。</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_.8fr_.8fr]">
          {/* 项目信息卡片 */}
          <div className="vip-card flex flex-col justify-between p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><CalendarDays size={19} /></span>
              <div><h3 className="text-base font-semibold">项目信息</h3><p className="mt-0.5 text-xs text-[#6b7280]">基础活动资料</p></div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[15px]">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">项目名称</p>
                <p className="font-semibold text-[#111827]">{project.name}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">活动日期</p>
                <p className="font-semibold text-[#111827]">{new Date(project.event_date).toLocaleDateString('zh-CN')}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">抽奖模式</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                  (project as any).mode === 'rolling'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {(project as any).mode === 'rolling' ? '轮动式' : '转盘式'}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">项目状态</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                  project.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' :
                  project.status === 'completed' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                  'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '草稿'}
                </span>
              </div>
            </div>
          </div>

          {/* 参与者统计 */}
          <div className="vip-card flex min-h-44 flex-col justify-between p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]"><UsersRound size={19} /></span>
            <p className="tabular-nums mt-5 text-4xl font-semibold text-[#111827]">
              {participants.length}
            </p>
            <p className="mt-1 text-sm text-[#6b7280]">已登记参与者</p>
          </div>

          {/* 奖项统计 */}
          <div className="vip-card flex min-h-44 flex-col justify-between p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff7ed] text-[#ea580c]"><Gift size={19} /></span>
            <p className="tabular-nums mt-5 text-4xl font-semibold text-[#111827]">
              {prizes.length}
            </p>
            <p className="mt-1 text-sm text-[#6b7280]">已配置奖项</p>
          </div>
        </div>

        {/* 快速操作 — 严格按模式分离 */}
        <div className="vip-card mt-6 p-6 sm:p-8">
          <div className="mb-6"><h3 className="text-lg font-semibold">操作导航</h3><p className="mt-1 text-sm text-[#6b7280]">选择一项任务继续管理当前项目。</p></div>
          
          {(project as any).mode === 'rolling' ? (
            /* ── 轮动式操作面板 ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <button
                onClick={() => setSettingsPanelOpen(true)}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><SlidersHorizontal size={19} /></span>
                <p className="mb-2 font-semibold text-[16px]">展会设置</p>
                <p className="text-sm leading-relaxed text-[#6b7280]">配置活动参数、参与者名单与舞台主题</p>
              </button>
              <button
                onClick={() => setSettingsPanelOpen(true)}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#fff7ed] text-[#ea580c]"><Gift size={19} /></span>
                <p className="mb-2 font-semibold text-[16px]">配置奖项</p>
                <p className="text-sm leading-relaxed text-[#6b7280]">管理奖品层级、数量与库存状态</p>
              </button>
              <button
                onClick={() => window.open(`/lottery?event=${projectId}&mode=admin`, '_blank')}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><MonitorUp size={19} /></span>
                <p className="mb-2 font-semibold text-[16px]">大屏开奖</p>
                <p className="text-sm leading-relaxed text-[#6b7280]">进入全屏轮动式抽奖舞台</p>
              </button>
              <button
                onClick={() => window.open(`/display?event=${projectId}`, '_blank')}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#ecfdf5] text-[#059669]"><UserCheck size={19} /></span>
                <p className="mb-2 font-semibold text-[16px]">签到看板</p>
                <p className="text-sm leading-relaxed text-[#6b7280]">实时查看访客签到与抽奖池状态</p>
              </button>
            </div>
          ) : (
            /* ── 转盘式操作面板 ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <button
                onClick={() => window.open(`/lottery/wheel?event=${projectId}`, '_blank')}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <p className="font-bold text-[17px] mb-2 flex items-center gap-2"><Eye size={18} className="text-blue-500" />预览转盘</p>
                <p className="text-xs text-gray-600 font-medium tracking-wide leading-relaxed">查看用户扫码后看到的转盘抽奖页面</p>
              </button>
              <button
                onClick={() => window.open(`/lottery/wheel/admin?event=${projectId}&mode=admin`, '_blank')}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <p className="font-bold text-[17px] mb-2 flex items-center gap-2 group-hover:text-blue-500 transition-colors"><Settings size={18} />管理后台</p>
                <p className="text-xs text-white/50 tracking-wide leading-relaxed">中奖记录、核销凭证、奖品库存管理</p>
              </button>
              <button
                onClick={() => setShowLinkModal(true)}
                className="vip-card vip-card-interactive p-6 text-left group"
              >
                <p className="font-bold text-[17px] mb-2 flex items-center gap-2 group-hover:text-blue-500 transition-colors"><QrCode size={18} />二维码与链接</p>
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
            className="vip-modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-4"
            onClick={() => setShowLinkModal(false)}
          >
            <div
              className="vip-modal p-8 w-full max-w-md transform animate-bounceIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={() => setShowLinkModal(false)}
                aria-label="关闭分享弹窗"
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
      <MobileBottomNav active="lottery" lotteryProjectId={projectId} />
    </div>
  );
};

export default ProjectSettingsPage;
