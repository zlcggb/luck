import { useState, useEffect, useRef, type CSSProperties, type SyntheticEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Square, Trophy, Grid, HelpCircle, Settings, Gift, ChevronRight, X } from 'lucide-react';
import {
  Participant,
  Prize,
  DrawRecord,
  DEFAULT_PRIZES,
  BackgroundMusicSettings,
  DEFAULT_BACKGROUND_MUSIC,
  ThemeId,
  ThemePalette,
  AvatarThemeId,
} from './types';
import { 
  saveParticipants, loadParticipants, 
  savePrizes, loadPrizes, 
  saveRecords, loadRecords,
  saveExcludedIds, loadExcludedIds,
  clearAllData,
  saveBackgroundMusicSettings,
  loadBackgroundMusicSettings,
  loadThemeId,
  saveThemeId,
  loadCustomThemePalette,
  saveCustomThemePalette,
  loadAvatarThemeId,
  saveAvatarThemeId,
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
import { DEFAULT_CUSTOM_THEME, DEFAULT_THEME_ID, getThemeById, paletteToCssVariables } from './theme';
import {
  loadProjectSettings,
  getThemeIdFromSettings,
  getCustomThemePaletteFromSettings,
  getAvatarThemeIdFromSettings,
  getBackgroundMusicFromSettings,
} from './utils/projectSettings';
import {
  drawRollingWinners,
  getCheckedInParticipants,
  getPrizes as getDbPrizes,
  getWinners,
  initDefaultRollingPrizes,
  syncEventPrizes,
  subscribeToParticipants,
  undoRollingWinner,
  broadcastLotteryEvent,
  subscribeToLotterySync,
} from './utils/supabaseCheckin';
import { buildRollingPool, mergeCheckedInParticipant } from './utils/rollingPool';
import {
  DEFAULT_AVATAR_THEME_ID,
  getAvatarCandidatesForParticipant,
  getAvatarFallbackUrlForParticipant,
  getAvatarUrlForParticipant,
} from './avatarTheme';

// --- 模拟数据 (当无导入数据时使用) ---
const MOCK_PARTICIPANTS: Participant[] = Array.from({ length: 100 }).map((_, i) => ({
  id: `EMP${String(i + 1).padStart(3, '0')}`,
  name: i % 3 === 0 ? `张伟${i}` : i % 3 === 1 ? `Lisa${i}` : `王强${i}`,
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
  dept: i % 3 === 0 ? '技术研发中心' : i % 3 === 1 ? '全球市场部' : '综合管理部',
}));

interface AppProps {
  onOpenCheckInDisplay?: () => void;
  isAdmin?: boolean;
}

const App = ({ onOpenCheckInDisplay, isAdmin = false }: AppProps) => {
  // 核心状态
  const [participants, setParticipants] = useState<Participant[]>([]); // 所有参与者
  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_PRIZES);        // 奖项配置
  const [records, setRecords] = useState<DrawRecord[]>([]);             // 抽奖记录
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set()); // 已中奖ID
  
  // UI 状态
  const [isRolling, setIsRolling] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<Participant[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAllWinners, setShowAllWinners] = useState(false); // 控制是否显示奖项汇总页
  const [mobilePrizeSidebarOpen, setMobilePrizeSidebarOpen] = useState(false); // 移动端奖项侧边栏
  
  // 当前选中的奖项和抽取数量
  const [currentPrizeId, setCurrentPrizeId] = useState<string>('');
  const [batchSize, setBatchSize] = useState(1);

  // 用户身份与中奖弹窗（用户端使用）
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('');
  const [currentUserInfo, setCurrentUserInfo] = useState<{ name?: string; dept?: string } | null>(null);
  const [currentUserWonPrize, setCurrentUserWonPrize] = useState<{ prizeName: string } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const avatarPreloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarPreloadChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarBackgroundPreloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prizeSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAvatarUrlsRef = useRef<Set<string>>(new Set());

  const participantsRef = useRef<Participant[]>(participants);
  const excludedIdsRef = useRef<Set<string>>(excludedIds);
  const prizesRef = useRef<Prize[]>(prizes);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    excludedIdsRef.current = excludedIds;
  }, [excludedIds]);

  useEffect(() => {
    prizesRef.current = prizes;
  }, [prizes]);

  useEffect(() => {
    return () => {
      if (prizeSyncTimerRef.current) clearTimeout(prizeSyncTimerRef.current);
    };
  }, []);

  // 使用内部弹窗
  const { showWarning, showConfirm } = useModal();

  // --- 初始化：优先从数据库加载项目数据，fallback 到 localStorage ---
  const [isInitialized, setIsInitialized] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState<BackgroundMusicSettings>(DEFAULT_BACKGROUND_MUSIC);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [customThemePalette, setCustomThemePalette] = useState<ThemePalette>(DEFAULT_CUSTOM_THEME);
  const [avatarThemeId, setAvatarThemeId] = useState<AvatarThemeId>(DEFAULT_AVATAR_THEME_ID);
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');

  // 读取并解析当前访问用户的工号信息
  useEffect(() => {
    const empFromUrl = searchParams.get('employee_id');
    let empId = empFromUrl ? empFromUrl.trim().toUpperCase() : '';
    let cachedName = '';

    if (eventId) {
      try {
        const stored = sessionStorage.getItem(`luck_user_${eventId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!empId && parsed.employeeId) {
            empId = String(parsed.employeeId).trim().toUpperCase();
          }
          if (parsed.name) {
            cachedName = String(parsed.name).trim();
          }
        }
      } catch {
        // ignore storage error
      }
    }

    if (empId) {
      setCurrentEmployeeId(empId);
      if (cachedName) {
        setCurrentUserInfo(prev => ({ ...prev, name: cachedName }));
      }
    }
  }, [searchParams, eventId]);

  // 根据工号从已加载参与者中补充匹配详细信息（姓名/部门）
  useEffect(() => {
    if (!currentEmployeeId || participants.length === 0) return;
    const matched = participants.find(
      p => p.id.trim().toUpperCase() === currentEmployeeId.toUpperCase()
    );
    if (matched) {
      setCurrentUserInfo({
        name: matched.name,
        dept: matched.dept,
      });
    }
  }, [currentEmployeeId, participants]);
  
  useEffect(() => {
    const init = async () => {
      let loadedParticipants: Participant[] = [];
      let loadedPrizes: Prize[] = DEFAULT_PRIZES;
      let loadedRecords: DrawRecord[] = [];
      let loadedExcludedIds = new Set<string>();

      // 如果有 eventId，优先从数据库加载
      if (eventId) {
        try {
          // 加载项目设置（主题/音乐/头像）
          const dbSettings = await loadProjectSettings(eventId);
          if (dbSettings) {
            setThemeId(getThemeIdFromSettings(dbSettings));
            setCustomThemePalette(getCustomThemePaletteFromSettings(dbSettings));
            setAvatarThemeId(getAvatarThemeIdFromSettings(dbSettings));
            setBackgroundMusic(getBackgroundMusicFromSettings(dbSettings));
          }

          let [dbParticipants, dbPrizes, dbWinners] = await Promise.all([
            getCheckedInParticipants(eventId),
            getDbPrizes(eventId),
            getWinners(eventId),
          ]);

          // 若数据库中尚无奖项，尝试自动初始化默认轮动奖项
          if (dbPrizes.length === 0) {
            dbPrizes = await initDefaultRollingPrizes(eventId);
          }

          loadedParticipants = buildRollingPool(dbParticipants, new Set());
          loadedExcludedIds = new Set(dbWinners.map(winner => winner.employee_id.trim().toUpperCase()));
          loadedRecords = dbWinners.map(winner => ({
            id: winner.id,
            timestamp: new Date(winner.won_at).getTime(),
            prizeId: winner.prize_id,
            prizeName: winner.prize?.name || '已中奖项',
            winners: [{
              id: winner.employee_id.trim().toUpperCase(),
              name: winner.name,
              dept: winner.department || '',
              avatar: winner.avatar || undefined,
            }],
          }));

          if (dbPrizes.length > 0) {
            loadedPrizes = dbPrizes.map(p => ({
              id: p.id,
              name: p.name,
              count: p.quantity,
              description: p.description || '',
              drawn: p.quantity - p.remaining,
              image: p.image || undefined,
            }));
          } else {
            // 真实活动下若未配置奖项，置空而不是保留 mock 数据，防止 UUID 报错
            loadedPrizes = [];
          }
        } catch (err) {
          console.error('从数据库加载项目数据失败:', err);
        }
      }

      // 只有本地演示模式才允许使用 mock/localStorage；真实活动空池即为空池。
      if (!eventId && loadedParticipants.length === 0) {
        const saved = loadParticipants();
        loadedParticipants = saved.length > 0 ? saved : MOCK_PARTICIPANTS;
      }
      if (!eventId) {
        // 无项目 ID 时从 localStorage 加载设置
        setBackgroundMusic(loadBackgroundMusicSettings());
        setThemeId(loadThemeId());
        setCustomThemePalette(loadCustomThemePalette());
        setAvatarThemeId(loadAvatarThemeId());
        loadedPrizes = loadPrizes();
        loadedRecords = loadRecords();
        loadedExcludedIds = loadExcludedIds();
      }

      setParticipants(loadedParticipants);
      setPrizes(loadedPrizes);
      setRecords(loadedRecords);
      setExcludedIds(loadedExcludedIds);
      
      // 设置默认选中的奖项
      if (loadedPrizes.length > 0) {
        const firstUnfinished = loadedPrizes.find(p => p.drawn < p.count);
        setCurrentPrizeId(firstUnfinished?.id || loadedPrizes[0].id);
      }
      
      // 标记初始化完成
      setIsInitialized(true);
    };

    init();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    return subscribeToParticipants(eventId, participant => {
      setParticipants(current => mergeCheckedInParticipant(current, participant));
    });
  }, [eventId]);

  // --- 持久化数据（只在初始化完成后才保存） ---
  useEffect(() => {
    if (!isInitialized || eventId) return;
    saveParticipants(participants);
  }, [participants, isInitialized, eventId]);

  useEffect(() => {
    if (!isInitialized || eventId) return;
    savePrizes(prizes);
  }, [prizes, isInitialized, eventId]);

  const latestPrizesRef = useRef<Prize[]>(prizes);

  useEffect(() => {
    latestPrizesRef.current = prizes;
  }, [prizes]);

  // 处理奖项变更并防抖同步至数据库
  const handlePrizesChange = (newPrizes: Prize[]) => {
    setPrizes(newPrizes);
    latestPrizesRef.current = newPrizes;

    if (!eventId) {
      savePrizes(newPrizes);
      return;
    }

    if (prizeSyncTimerRef.current) {
      clearTimeout(prizeSyncTimerRef.current);
    }

    prizeSyncTimerRef.current = setTimeout(async () => {
      try {
        const payload = latestPrizesRef.current;
        const syncedDbPrizes = await syncEventPrizes(eventId, payload);
        if (syncedDbPrizes.length > 0) {
          // 只针对本地临时生成 ID 的新建奖项更新其真实 UUID，绝不覆盖用户正在输入的文本
          setPrizes(current =>
            current.map((p, index) => {
              if (p.id.startsWith('prize_')) {
                const dbMatch = syncedDbPrizes[index] || syncedDbPrizes.find(dp => dp.sort_order === index);
                if (dbMatch) {
                  return { ...p, id: dbMatch.id };
                }
              }
              return p;
            })
          );
        }
      } catch (error) {
        console.error('抽奖大屏防抖同步奖项失败:', error);
      }
    }, 800);
  };

  useEffect(() => {
    if (!isInitialized || eventId) return;
    saveRecords(records);
  }, [records, isInitialized, eventId]);

  useEffect(() => {
    if (!isInitialized || eventId) return;
    saveExcludedIds(excludedIds);
  }, [excludedIds, isInitialized, eventId]);

  useEffect(() => {
    if (!isInitialized) return;
    saveBackgroundMusicSettings(backgroundMusic);
  }, [backgroundMusic, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveThemeId(themeId);
  }, [themeId, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveCustomThemePalette(customThemePalette);
  }, [customThemePalette, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    saveAvatarThemeId(avatarThemeId);
  }, [avatarThemeId, isInitialized]);

  useEffect(() => {
    if (backgroundMusic.src) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [backgroundMusic.src]);

  const getAvatarUrl = (person: Participant): string => {
    return getAvatarUrlForParticipant(person, avatarThemeId);
  };

  const getAvatarFallbackUrl = (person: Participant): string => {
    return getAvatarFallbackUrlForParticipant(person, avatarThemeId);
  };

  const handleAvatarImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const fallback = img.dataset.fallback;
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    }
  };

  const preloadAvatarBatch = (batch: Participant[], candidateLimit: number) => {
    batch.forEach((participant) => {
      const candidates = getAvatarCandidatesForParticipant(participant, avatarThemeId).slice(0, candidateLimit);
      candidates.forEach((avatarUrl) => {
        if (!avatarUrl || preloadedAvatarUrlsRef.current.has(avatarUrl)) return;
        const img = new Image();
        img.src = avatarUrl;
        preloadedAvatarUrlsRef.current.add(avatarUrl);
      });
    });
  };

  useEffect(() => {
    if (avatarPreloadTimerRef.current) {
      clearTimeout(avatarPreloadTimerRef.current);
      avatarPreloadTimerRef.current = null;
    }
    if (avatarPreloadChunkTimerRef.current) {
      clearTimeout(avatarPreloadChunkTimerRef.current);
      avatarPreloadChunkTimerRef.current = null;
    }
    if (avatarBackgroundPreloadTimerRef.current) {
      clearTimeout(avatarBackgroundPreloadTimerRef.current);
      avatarBackgroundPreloadTimerRef.current = null;
    }
    if (participants.length === 0 || typeof window === 'undefined') return;

    // 第一阶段：优先把预览区常用头像加载好，确保界面反馈更快。
    const previewParticipants = participants.slice(0, 6);
    avatarPreloadTimerRef.current = setTimeout(() => {
      preloadAvatarBatch(previewParticipants, 2);
    }, 250);

    // 第二阶段：再按批次后台加载其余头像，避免一次性请求过多导致卡顿。
    avatarBackgroundPreloadTimerRef.current = setTimeout(() => {
      const restParticipants = participants.slice(6);
      let cursor = 0;
      const chunkSize = 20;

      const preloadNextChunk = () => {
        const chunk = restParticipants.slice(cursor, cursor + chunkSize);
        if (chunk.length === 0) return;

        preloadAvatarBatch(chunk, 1);
        cursor += chunkSize;
        avatarPreloadChunkTimerRef.current = setTimeout(preloadNextChunk, 180);
      };

      preloadNextChunk();
    }, 1800);

    return () => {
      if (avatarPreloadTimerRef.current) {
        clearTimeout(avatarPreloadTimerRef.current);
        avatarPreloadTimerRef.current = null;
      }
      if (avatarPreloadChunkTimerRef.current) {
        clearTimeout(avatarPreloadChunkTimerRef.current);
        avatarPreloadChunkTimerRef.current = null;
      }
      if (avatarBackgroundPreloadTimerRef.current) {
        clearTimeout(avatarBackgroundPreloadTimerRef.current);
        avatarBackgroundPreloadTimerRef.current = null;
      }
    };
  }, [participants, avatarThemeId]);

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
      if (eventId) {
        void broadcastLotteryEvent(eventId, { type: 'RESET_DISPLAY' });
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

      if (eventId) {
        void broadcastLotteryEvent(eventId, {
          type: 'PRIZE_CHANGE',
          prizeId,
        });
      }
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

  // 订阅抽奖全流程同频广播与中奖数据同步（用户端与管理端多端实时联动）
  useEffect(() => {
    if (!eventId) return;

    return subscribeToLotterySync(eventId, {
      onBroadcast: (action) => {
        if (action.type === 'DRAW_START') {
          if (action.prizeId) {
            setCurrentPrizeId(action.prizeId);
          }
          if (action.batchSize) {
            setBatchSize(action.batchSize);
          }
          setShowConfetti(false);
          setHasDrawn(false);
          setShowAllWinners(false);
          setIsRolling(true);

          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            const currentPool = participantsRef.current;
            const currentExcluded = excludedIdsRef.current;
            const available = currentPool.filter(p => !currentExcluded.has(p.id));
            const poolToUse = available.length > 0 ? available : currentPool;
            const batch = getRandomBatch(poolToUse, action.batchSize || 1);
            setCurrentDisplay(batch);
          }, 80);
        } else if (action.type === 'DRAW_STOP') {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsRolling(false);
          setShowConfetti(true);
          setHasDrawn(true);

          const normalizedWinners: Participant[] = action.winners.map(w => ({
            id: w.id,
            name: w.name,
            dept: w.dept || '',
            avatar: w.avatar,
          }));
          setCurrentDisplay(normalizedWinners);

          const curPrize = prizesRef.current.find(p => p.id === action.prizeId);
          const prizeName = curPrize?.name || '中奖奖项';

          const newRecord: DrawRecord = {
            id: `record_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
            prizeId: action.prizeId,
            prizeName,
            winners: normalizedWinners,
          };
          setRecords(prev => [newRecord, ...prev]);

          setExcludedIds(prev => {
            const next = new Set(prev);
            action.winners.forEach(w => next.add(w.id.trim().toUpperCase()));
            return next;
          });

          setPrizes(prev => prev.map(p =>
            p.id === action.prizeId
              ? { ...p, drawn: p.drawn + action.winners.length }
              : p
          ));

          // 检查当前用户是否中奖
          if (currentEmployeeId) {
            const isMe = action.winners.some(
              w => w.id.trim().toUpperCase() === currentEmployeeId.toUpperCase()
            );
            if (isMe) {
              setCurrentUserWonPrize({ prizeName });
            }
          }
        } else if (action.type === 'PRIZE_CHANGE') {
          if (action.prizeId) {
            setCurrentPrizeId(action.prizeId);
            resetDisplay(false);
          }
        } else if (action.type === 'RESET_DISPLAY') {
          resetDisplay(false);
        }
      },
      onWinnerInsert: (newWinner) => {
        const winnerId = newWinner.employee_id.trim().toUpperCase();
        setExcludedIds(prev => {
          if (prev.has(winnerId)) return prev;
          const next = new Set(prev);
          next.add(winnerId);
          return next;
        });

        // 检查个人是否中奖
        if (currentEmployeeId && winnerId === currentEmployeeId.toUpperCase()) {
          const prizeName = newWinner.prize?.name || prizesRef.current.find(p => p.id === newWinner.prize_id)?.name || '大奖';
          setCurrentUserWonPrize({ prizeName });
        }
      },
      onWinnerDelete: (oldWinner) => {
        if (oldWinner.id) {
          setRecords(prev => prev.filter(r => r.id !== oldWinner.id));
        }
        if (oldWinner.employee_id) {
          const empId = oldWinner.employee_id.trim().toUpperCase();
          setExcludedIds(prev => {
            const next = new Set(prev);
            next.delete(empId);
            return next;
          });
        }
      },
      onPrizeUpdate: (updatedPrize) => {
        setPrizes(prev => prev.map(p => {
          if (p.id === updatedPrize.id) {
            return {
              ...p,
              name: updatedPrize.name,
              count: updatedPrize.quantity,
              drawn: updatedPrize.quantity - updatedPrize.remaining,
              description: updatedPrize.description || '',
            };
          }
          return p;
        }));
      },
    });
  }, [eventId, currentEmployeeId]);

  // --- 核心逻辑：开始/停止抽奖 ---
  const toggleLottery = () => {
    if (isRolling) {
      void stopLottery();
    } else {
      startLottery();
    }
  };

  const startLottery = () => {
    if (!currentPrize) {
      showWarning(eventId ? "当前活动尚未配置奖项，请在管理后台先添加奖项！" : "请先选择一个奖项！");
      return;
    }
    if (eventId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentPrize.id)) {
      showWarning("当前奖项未同步至云端，请在活动设置中保存并刷新奖项后再开奖！");
      return;
    }
    if (availableParticipants.length === 0) {
      showWarning(eventId ? "抽奖池为空！请先让参会人员扫码签到。" : "奖池已空！请导入参与者名单。");
      return;
    }
    if (availableParticipants.length < batchSize) {
      showWarning(`抽奖池可用人数不足 ${batchSize} 人！（当前仅有 ${availableParticipants.length} 人可抽）`);
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
    setHasDrawn(false);

    if (eventId) {
      void broadcastLotteryEvent(eventId, {
        type: 'DRAW_START',
        prizeId: currentPrize.id,
        batchSize,
      });
    }

    timerRef.current = setInterval(() => {
      const batch = getRandomBatch(availableParticipants, batchSize);
      setCurrentDisplay(batch);
    }, 80);
  };

  const stopLottery = async () => {
    if (!timerRef.current || !currentPrize) return;
    
    clearInterval(timerRef.current);
    timerRef.current = null;

    let finalWinners: Participant[];
    if (eventId) {
      const result = await drawRollingWinners(eventId, currentPrize.id, batchSize);
      if (!result.success || !result.data) {
        setIsRolling(false);
        setShowConfetti(false);
        showWarning(result.error || '开奖失败，请重试');
        return;
      }
      finalWinners = result.data.map(winner => ({
        id: winner.employee_id.trim().toUpperCase(),
        name: winner.name,
        dept: winner.department || '',
        avatar: winner.avatar || undefined,
      }));
    } else {
      finalWinners = getRandomBatch(availableParticipants, batchSize);
    }

    setIsRolling(false);
    setShowConfetti(true);
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

    // 广播开奖结果给其他端
    if (eventId) {
      void broadcastLotteryEvent(eventId, {
        type: 'DRAW_STOP',
        prizeId: currentPrize.id,
        winners: finalWinners,
      });
    }

    // 检查当前用户是否中奖
    if (currentEmployeeId) {
      const isMe = finalWinners.some(
        w => w.id.trim().toUpperCase() === currentEmployeeId.toUpperCase()
      );
      if (isMe) {
        setCurrentUserWonPrize({ prizeName: currentPrize.name });
      }
    }
  };

  // 撤销某轮抽奖
  const handleUndoRecord = async (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;
    
    const confirmed = await showConfirm(`确定要撤销本轮抽奖吗？\n奖项：${record.prizeName}\n中奖者：${record.winners.map(w => w.name).join('、')}`);
    if (!confirmed) {
      return;
    }
    
    // 如果存在后端活动，调用数据库原子撤销中奖记录并恢复库存
    if (eventId) {
      await undoRollingWinner(eventId, recordId);
    }

    // 从已中奖集合中移除
    const newExcludedIds = new Set(excludedIds);
    record.winners.forEach(w => newExcludedIds.delete(w.id.trim().toUpperCase()));
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
    setThemeId(DEFAULT_THEME_ID);
    setCustomThemePalette(DEFAULT_CUSTOM_THEME);
    setAvatarThemeId(DEFAULT_AVATAR_THEME_ID);
    setCurrentDisplay([]);
    setShowConfetti(false);
    setHasDrawn(false);
    setCurrentPrizeId(DEFAULT_PRIZES[0].id);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsMusicPlaying(false);
    }
  };



  // 使用布局算法获取卡片样式
  const cardStyle = getDrawingCardStyle(batchSize);

  // 获取最近中奖者（用于底部走马灯）
  const recentWinners = records.flatMap(r => r.winners).slice(0, 20);
  const activePalette = themeId === 'custom'
    ? customThemePalette
    : getThemeById(themeId).palette;
  const themeStyle = paletteToCssVariables(activePalette) as unknown as CSSProperties;

  return (
    <div
      data-theme={themeId}
      style={themeStyle}
      className="relative min-h-screen w-full overflow-hidden font-sans text-white selection:bg-[var(--color-accent)] selection:text-white"
    >
      <audio
        ref={audioRef}
        src={backgroundMusic.src || undefined}
        loop
        preload="auto"
        className="hidden"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
      />
      
      {/* --- 背景层 --- */}
      <div className="absolute inset-0 z-0 bg-[var(--color-bg-base)]">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-pulse"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse delay-1000"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--color-bg-deep-rgb)/0.32)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--color-bg-deep-rgb)/0.32)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] border-white/5"></div>
      </div>

      {/* --- 主内容容器 --- */}
      <div className="relative z-10 flex flex-col h-screen p-3 md:p-4 lg:p-6">
        
        {/* 1. 顶部 Header - Updated Design for Mobile */}
        <header className="w-full flex justify-between items-center px-4 py-4 md:px-6 md:py-6 border-b border-white/5 backdrop-blur-sm shrink-0">
          <div className="flex flex-col max-w-[65%] md:max-w-none">
            <h1 className="text-2xl md:text-5xl font-black tracking-wider uppercase italic flex flex-wrap items-center gap-2 md:gap-3 leading-none">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-text-strong)] via-[var(--color-text-strong)] to-[var(--color-text-secondary)] drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                {currentPrize ? currentPrize.name : 'ANNUAL GALA'}
              </span>
              <span className="text-lg md:text-3xl text-[var(--color-accent)] not-italic font-medium opacity-80 decoration-2 underline-offset-4">
                 <span className="hidden md:inline">/ </span>
                 {currentPrize ? (currentPrize.description || currentPrize.name) : 'LUCKY DRAW'}
              </span>
            </h1>
            <p className="text-[var(--color-text-secondary)] font-medium tracking-[0.2em] uppercase text-[9px] md:text-xs mt-1 md:mt-2 ml-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
              Lucky Draw System
            </p>
          </div>

          {/* 右侧控制区 */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* 用户工号展示（当存在 employee_id 时） */}
            {currentEmployeeId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200 text-xs md:text-sm backdrop-blur-md shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono font-semibold tracking-wide">工号: {currentEmployeeId}</span>
                {currentUserInfo?.name && (
                  <span className="text-white/90 font-medium">({currentUserInfo.name})</span>
                )}
              </div>
            )}

            {/* 管理员端显示人数切换，普通用户端显示当前每轮人数标签 */}
            {isAdmin ? (
              <div className="flex items-center bg-[color:rgb(var(--color-bg-base-rgb)/0.5)] backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-inner scale-90 md:scale-100 origin-right">
                {availableBatchSizes.length === 0 ? (
                  <span className="text-[var(--color-text-muted)] text-xs px-3 py-1">--</span>
                ) : (
                  availableBatchSizes.map(num => (
                    <button
                      key={num}
                      onClick={() => handleBatchSizeChange(num)}
                      disabled={isRolling}
                      className={`
                        w-8 h-8 md:w-10 md:h-10 rounded-lg text-sm md:text-base font-bold transition-all flex items-center justify-center
                        ${batchSize === num 
                          ? 'bg-[var(--color-primary)] text-white shadow-lg scale-105' 
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-strong)] hover:bg-white/10'
                        }
                        ${isRolling ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {num}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="flex items-center bg-white/5 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/10 text-xs text-white/70">
                <span className="text-white/90 font-medium">单轮 {batchSize} 人</span>
              </div>
            )}

            {/* 设置按钮 - 仅管理员可见（常驻显眼展示） */}
            {isAdmin && (
              <>
              <div className="h-8 w-[1px] bg-white/10 hidden md:block"></div>
             
              <button 
                onClick={() => setSettingsOpen(true)} 
                className="flex items-center gap-1.5 px-3 py-2 md:px-3.5 md:py-2.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 rounded-xl text-white border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all hover:scale-105 active:scale-95 shrink-0 group"
                title="项目与抽奖设置"
              >
                <Settings size={18} className="text-blue-400 group-hover:rotate-90 transition-transform duration-300 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-semibold tracking-wide text-white">设置</span>
              </button>
              </>
            )}
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
                bg-gradient-to-br from-[color:rgb(var(--color-bg-deep-rgb)/0.98)] via-[color:rgb(var(--color-bg-deep-rgb)/0.9)] to-[color:rgb(var(--color-bg-base-rgb)/0.98)]
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
                  <Gift size={18} className="text-[var(--color-accent)]" />
                  <span>Prize Gallery</span>
                </div>
                <button 
                  onClick={() => setMobilePrizeSidebarOpen(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X size={18} className="text-[var(--color-text-muted)]" />
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
                          ? 'bg-gradient-to-r from-[color:rgb(var(--color-accent-rgb)/0.3)] via-[color:rgb(var(--color-secondary-rgb)/0.2)] to-transparent border border-[color:rgb(var(--color-accent-rgb)/0.5)] shadow-[0_0_20px_rgb(var(--color-accent-rgb)/0.2)]' 
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
                            ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)]' 
                            : isCompleted 
                              ? 'bg-gradient-to-br from-[color:rgb(var(--color-accent-rgb)/0.2)] to-[color:rgb(var(--color-secondary-rgb)/0.2)] border border-[color:rgb(var(--color-accent-rgb)/0.35)]'
                              : 'bg-white/5 border border-white/10'
                          }
                        `}>
                          {prize.image ? (
                            <img src={prize.image} alt={prize.name} className="w-full h-full object-cover" />
                          ) : (
                            <Trophy size={20} className={isActive ? 'text-white' : isCompleted ? 'text-[var(--color-accent)]' : 'text-white/40'} />
                          )}
                        </div>
                        
                        {/* 奖项信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm truncate ${isActive ? 'text-[var(--color-text-strong)]' : 'text-[var(--color-text-secondary)]'}`}>
                              {prize.name}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-[8px] font-bold text-white shrink-0">
                                当前
                              </span>
                            )}
                            {isCompleted && !isActive && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[color:rgb(var(--color-accent-rgb)/0.18)] text-[var(--color-accent)] border border-[color:rgb(var(--color-accent-rgb)/0.35)] text-[8px] font-bold shrink-0">
                                完成
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                            {prize.description || prize.name}
                          </p>
                          
                          {/* 进度条 */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-[var(--color-accent)]' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 ${isCompleted ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                              {prize.drawn}/{prize.count}
                            </span>
                          </div>
                        </div>
                        
                        {/* 箭头 */}
                        <ChevronRight size={16} className={`shrink-0 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-white/20'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 底部装饰 */}
              <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                <div className="text-center text-[10px] text-[var(--color-text-soft)] uppercase tracking-wider">
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
                <Gift size={16} className="text-[var(--color-accent)]" />
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
                        ? 'w-full h-48 border-[color:rgb(var(--color-accent-rgb)/0.5)] shadow-[0_0_30px_rgb(var(--color-accent-rgb)/0.25)] bg-gradient-to-br from-[color:rgb(var(--color-accent-rgb)/0.3)] via-[color:rgb(var(--color-secondary-rgb)/0.2)] to-[var(--color-bg-base)]' 
                        : 'w-full h-20 border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/10'
                      }
                      ${isRolling ? 'opacity-50 pointer-events-none grayscale' : ''}
                    `}
                  >
                    {/* Background Image - Only visible when active */}
                    <div className="absolute inset-0 z-0 bg-[var(--color-bg-base)]">
                      {prize.image && (
                        <img 
                          src={prize.image} 
                          alt={prize.name} 
                          className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'opacity-60 blur-[2px] scale-110' : 'opacity-0 scale-100'}`} 
                        />
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] via-[color:rgb(var(--color-bg-base-rgb)/0.6)] to-transparent transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
                      
                      {/* Active Glow Effect */}
                      {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-accent)] blur-[60px] opacity-20 rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>}
                    </div>

                    {/* Content */}
                    <div className="relative z-10 p-4 h-full flex flex-col justify-center">
                      
                      {/* Top Row: Level Name & Badge */}
                      <div className={`flex items-center justify-between transition-all duration-500 z-10 ${isActive ? 'mb-auto' : ''}`}>
                        <span className={`font-black uppercase tracking-wider transition-all duration-500 truncate mr-2 ${isActive ? 'text-3xl text-[var(--color-text-strong)] translate-y-2 text-shadow' : 'text-base text-[var(--color-text-muted)] group-hover:text-[var(--color-text-strong)]'}`}>
                          {prize.name}
                        </span>
                        
                        {isActive && (
                          <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[10px] font-bold tracking-wider text-white shadow-lg animate-fade-in border border-white/10 whitespace-nowrap">
                            ACTIVE
                          </div>
                        )}
                        {!isActive && isCompleted && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:rgb(var(--color-accent-rgb)/0.16)] text-[var(--color-accent)] text-[10px] font-bold tracking-wider border border-[color:rgb(var(--color-accent-rgb)/0.3)] whitespace-nowrap">
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
                            <span className={`font-mono font-bold text-sm ${prize.drawn >= prize.count ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}`}>
                              Qty: {prize.count - prize.drawn}
                            </span>
                            {/* Progress Bar */}
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
                              <div 
                                className={`h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${prize.drawn >= prize.count ? 'bg-[var(--color-accent)]' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]'}`}
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
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] rounded-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] blur-[100px] opacity-10 transition-all duration-300 ${isRolling ? 'opacity-30 scale-110' : ''}`}></div>

            {/* 当前奖项提示 (Mobile Only: Floating top if needed, otherwise rely on sidebar active state) - Optional, kept standard */}
            {currentPrize && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 pt-2 md:pt-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] md:text-sm shadow-xl backdrop-blur-md bg-gradient-to-r from-[color:rgb(var(--color-accent-rgb)/0.2)] to-[color:rgb(var(--color-secondary-rgb)/0.2)] border-[color:rgb(var(--color-accent-rgb)/0.3)]">
                  <span className="font-bold text-[var(--color-accent)]">{currentPrize.name}</span>
                  {isPrizeCompleted ? (
                    <span className="text-[color:rgb(var(--color-accent-rgb)/0.75)]">✓ 已抽完 · 共 {currentPrize.count} 人</span>
                  ) : (
                    <span className="text-[var(--color-text-soft)]">剩余 {currentPrize.count - currentPrize.drawn}</span>
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
                              className={`relative overflow-hidden bg-gradient-to-br from-[color:rgb(var(--color-accent-rgb)/0.16)] to-[color:rgb(var(--color-secondary-rgb)/0.18)] backdrop-blur-xl border border-[color:rgb(var(--color-accent-rgb)/0.35)] rounded-xl md:rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgb(var(--color-accent-rgb)/0.2)] hover:shadow-[0_0_35px_rgb(var(--color-accent-rgb)/0.35)] transition-all duration-300 hover:scale-[1.03] shrink-0 ${style.container} ${style.padding}`}
                            >
                              {/* Winner 标记 */}
                              <div className="absolute top-1 left-1 md:top-2 md:left-2 px-1.5 md:px-2 py-0.5 md:py-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-md text-[7px] md:text-[9px] font-bold uppercase tracking-wider shadow-lg">
                                ★ Winner
                              </div>
                              
                              {/* 序号 */}
                              <div className="absolute top-1 right-1 md:top-2 md:right-2 px-1.5 md:px-2 py-0.5 bg-white/10 rounded-md text-[8px] md:text-[10px] font-bold text-[var(--color-text-muted)]">
                                #{itemIndex - rowCount + idx + 1}
                              </div>
                              
                              {/* 头像 */}
                              <div className="mt-3 md:mt-5">
                                <img 
                                  src={getAvatarUrl(winner)} 
                                  data-fallback={getAvatarFallbackUrl(winner)}
                                  onError={handleAvatarImageError}
                                  alt="avatar" 
                                  className={`rounded-full object-cover shadow-xl border-2 md:border-4 border-[color:rgb(var(--color-accent-rgb)/0.6)] ${style.avatar}`}
                                />
                              </div>
                              
                              {/* 信息 */}
                              <div className="text-center mt-1.5 md:mt-3 min-w-0 w-full px-1">
                                <h3 className={`font-black text-white truncate drop-shadow-md ${style.name}`}>
                                  {winner.name}
                                </h3>
                                <p className={`text-[color:rgb(var(--color-accent-rgb)/0.86)] truncate font-medium mt-0.5 ${style.dept}`}>
                                  {winner.dept}
                                </p>
                                <p className={`text-[var(--color-text-secondary)] mt-0.5 ${style.id || 'text-[8px] md:text-[10px]'}`}>
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
                                  ${showConfetti ? 'ring-2 ring-[var(--color-accent)] scale-[1.01] shadow-[0_0_30px_rgb(var(--color-accent-rgb)/0.3)]' : ''}
                                `}
                              >
                                <div className="absolute top-0 right-0 p-1 md:p-2 opacity-30">
                                  <Grid size={12} />
                                </div>

                                <div className={`flex items-center ${cardStyle.layout}`}>
                                  <div className="relative group shrink-0">
                                    {isRolling && <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] blur-md animate-spin"></div>}
                                    <img 
                                      src={getAvatarUrl(user)} 
                                      data-fallback={getAvatarFallbackUrl(user)}
                                      onError={handleAvatarImageError}
                                      alt="avatar" 
                                      className={`
                                        relative rounded-full object-cover shadow-2xl transition-all
                                        ${cardStyle.avatar}
                                        ${isRolling ? 'border-white/20 scale-95' : 'border-[var(--color-accent)] scale-100'}
                                      `}
                                    />
                                  </div>

                                  <div className="min-w-0 text-center">
                                    <h2 className={`
                                      font-black text-transparent bg-clip-text bg-gradient-to-b from-[var(--color-text-strong)] to-[var(--color-text-secondary)] drop-shadow-md truncate
                                      ${cardStyle.name}
                                      ${isRolling ? 'blur-[1px]' : ''}
                                    `}>
                                      {user.name}
                                    </h2>
                                    <p className={`font-light tracking-widest text-[var(--color-text-secondary)] uppercase truncate ${cardStyle.dept}`}>
                                      {user.dept}
                                    </p>
                                    {showConfetti && (
                                      <p className="text-[var(--color-text-muted)] mt-0.5 text-[8px] md:text-[10px]">
                                        工号: {user.id}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {showConfetti && (
                                  <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 px-1 md:px-1.5 py-0.5 bg-[var(--color-accent)] rounded text-[6px] md:text-[8px] font-bold uppercase tracking-wider animate-bounce">
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
                      ${showConfetti ? 'ring-2 ring-[var(--color-accent)] scale-[1.01] shadow-[0_0_30px_rgb(var(--color-accent-rgb)/0.3)]' : ''}
                    `}
                  >
                    <div className="absolute top-0 right-0 p-1 md:p-2 opacity-30">
                      <Grid size={batchSize >= 9 ? 10 : batchSize >= 4 ? 12 : 16} />
                    </div>

                    <div className={`flex items-center ${cardStyle.layout}`}>
                      <div className="relative group shrink-0">
                         {isRolling && <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-accent)] blur-md animate-spin"></div>}
                         <img 
                          src={getAvatarUrl(user)} 
                          data-fallback={getAvatarFallbackUrl(user)}
                          onError={handleAvatarImageError}
                          alt="avatar" 
                          className={`
                            relative rounded-full object-cover shadow-2xl transition-all
                            ${cardStyle.avatar}
                            ${isRolling ? 'border-white/20 scale-95' : 'border-[var(--color-accent)] scale-100'}
                          `}
                        />
                      </div>

                      <div className={`min-w-0 ${batchSize === 1 ? 'text-center md:text-left' : 'text-center'}`}>
                        <h2 className={`
                          font-black text-transparent bg-clip-text bg-gradient-to-b from-[var(--color-text-strong)] to-[var(--color-text-secondary)] drop-shadow-md truncate
                          ${cardStyle.name}
                          ${isRolling ? 'blur-[1px]' : ''}
                        `}>
                          {user.name}
                        </h2>
                        <p className={`font-light tracking-widest text-[var(--color-text-secondary)] uppercase truncate ${cardStyle.dept}`}>
                          {user.dept}
                        </p>
                        {showConfetti && batchSize < 16 && (
                          <p className={`text-[var(--color-text-muted)] mt-0.5 ${batchSize >= 9 ? 'text-[8px] md:text-[10px]' : 'text-[10px] md:text-xs'}`}>
                            工号: {user.id}
                          </p>
                        )}
                      </div>
                    </div>

                    {showConfetti && (
                       <div className={`absolute top-0.5 left-0.5 md:top-1 md:left-1 px-1 md:px-1.5 py-0.5 bg-[var(--color-accent)] rounded text-[6px] md:text-[8px] font-bold uppercase tracking-wider animate-bounce ${batchSize >= 16 ? 'hidden md:block' : ''}`}>
                         Winner
                       </div>
                    )}
                  </div>
                ))
              )}
            </div>
            )}

          {/* 启动按钮与状态区域 */}
          <div className="mt-4 md:mt-6 z-30 shrink-0 flex items-center justify-center gap-2 md:gap-3">
            {/* Mobile: 奖项切换按钮 - 与主按钮水平对齐 */}
            <button
              onClick={() => setMobilePrizeSidebarOpen(true)}
              className={`
                md:hidden
                px-3 py-2 rounded-full font-bold
                transition-all duration-300 transform hover:scale-105 active:scale-95
                shadow-[0_4px_20px_rgba(0,0,0,0.3)]
                bg-gradient-to-r from-[color:rgb(var(--color-accent-rgb)/0.8)] to-[color:rgb(var(--color-secondary-rgb)/0.8)] backdrop-blur-sm text-white border border-white/20 hover:border-[color:rgb(var(--color-accent-rgb)/0.5)]
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
            
            {/* 管理员端控制按钮 */}
            {isAdmin ? (
              <button
                onClick={() => {
                  if (isPrizeCompleted && !showAllWinners) {
                    setShowAllWinners(true);
                  } else {
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
                      ? 'bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white ring-2 md:ring-4 ring-[color:rgb(var(--color-accent-rgb)/0.35)]'
                      : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white ring-2 md:ring-4 ring-[color:rgb(var(--color-primary-rgb)/0.3)]'
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
            ) : (
              /* 用户端：无抽奖按钮，实时同频状态展示 */
              <div className="flex items-center gap-2">
                {isRolling ? (
                  <div className="flex items-center gap-2 px-4 py-2 md:px-8 md:py-3 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 border border-pink-400/40 backdrop-blur-md shadow-[0_0_25px_rgba(236,72,153,0.3)] animate-pulse">
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-ping" />
                    <span className="text-xs md:text-base font-bold text-white tracking-wider">🎉 现场大屏正在抽奖中...</span>
                  </div>
                ) : isPrizeCompleted && !showAllWinners ? (
                  <button
                    onClick={() => setShowAllWinners(true)}
                    className="px-4 py-2 md:px-8 md:py-3 rounded-full font-bold text-xs md:text-sm tracking-wider bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white border border-white/20 shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Trophy size={16} />
                    <span>查看中奖名单({currentPrize?.count}人)</span>
                  </button>
                ) : showAllWinners ? (
                  <div className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-white/90 text-xs md:text-sm font-medium">
                    <Trophy size={15} className="text-amber-400" />
                    <span>本奖项已全部揭晓</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-white/80 text-xs md:text-sm font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400/80"></span>
                    <span>✨ 关注现场大屏开奖 · 祝您好运</span>
                  </div>
                )}
              </div>
            )}
          </div>
            </main>
        </div>

        {/* 3. 底部：中奖名单走马灯 */}
        <footer className="w-full h-12 md:h-14 mt-2 relative rounded-lg md:rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden flex flex-col justify-center shrink-0">
          <div className="absolute top-1 md:top-1.5 left-3 md:left-4 text-[8px] md:text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse"></div>
             最新中奖
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto px-3 md:px-4 pt-2.5 md:pt-2 no-scrollbar scroll-smooth h-full">
            {recentWinners.length === 0 ? (
              <div className="w-full text-center text-[var(--color-text-soft)] italic text-[10px] md:text-xs">等待抽奖...</div>
            ) : (
              recentWinners.map((winner, idx) => (
                <div key={`${winner.id}-${idx}`} className="flex-shrink-0 flex items-center gap-1 bg-black/30 pr-2 pl-1 py-0.5 rounded-full border border-white/5">
                  <img
                    src={getAvatarUrl(winner)}
                    data-fallback={getAvatarFallbackUrl(winner)}
                    onError={handleAvatarImageError}
                    className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-[var(--color-accent)]"
                    alt=""
                  />
                  <span className="text-white font-bold text-[8px] md:text-[10px]">{winner.name}</span>
                </div>
              ))
            )}
          </div>
        </footer>

      </div>

      {/* 4. 专属中奖弹窗（当当前用户中奖时弹出） */}
      {currentUserWonPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl p-6 text-center border border-amber-400/50 bg-gradient-to-b from-[#1f1638] to-[#0d091f] shadow-[0_0_50px_rgba(245,158,11,0.4)] animate-scale-up">
            {/* 关闭按钮 */}
            <button
              onClick={() => setCurrentUserWonPrize(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* 奖杯图标 */}
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-bounce">
              <Trophy size={40} className="text-amber-950" />
            </div>

            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 mb-1">
              🎉 恭喜您中奖啦！
            </h3>
            <p className="text-white/80 text-sm font-medium mb-4">
              好运降临，您已斩获本轮大奖！
            </p>

            <div className="p-4 rounded-2xl bg-white/10 border border-amber-300/20 mb-5">
              <div className="text-xs text-amber-300/80 mb-1 font-semibold uppercase tracking-wider">中奖奖项</div>
              <div className="text-xl font-black text-white">{currentUserWonPrize.prizeName}</div>
              <div className="text-xs text-white/60 mt-1 font-mono">工号：{currentEmployeeId}</div>
            </div>

            <button
              onClick={() => setCurrentUserWonPrize(null)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black text-base shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              太棒了，收下好运！
            </button>
          </div>
        </div>
      )}

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        participants={participants}
        onParticipantsChange={setParticipants}
        prizes={prizes}
        onPrizesChange={handlePrizesChange}
        records={records}
        onRecordsChange={setRecords}
        onUndoRecord={handleUndoRecord}
        onClearAll={handleClearAll}
        onOpenCheckInDisplay={onOpenCheckInDisplay}
        currentEventId={eventId || undefined}
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
    </div>
  );
};

export default App;
