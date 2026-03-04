import { useState, useEffect, useRef, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Upload, Download, FileSpreadsheet, Award, History, 
  Trash2, Plus, Minus, RotateCcw, AlertCircle, QrCode, MapPin,
  Sparkles, ChevronRight, Monitor, Settings2, FolderOpen, Loader2,
  LogIn, Search, UserPlus, Eye, Palette
} from 'lucide-react';
import { Participant, Prize, DrawRecord, BackgroundMusicSettings, ThemeId, ThemePalette, AvatarThemeId } from '../types';
import { exportWinnersToExcel, downloadTemplate, parseExcelFile, processImportData } from '../utils/excel';
import { CheckInSettings, DEFAULT_CHECKIN_SETTINGS } from '../types/checkin';
import { saveCheckInSettings, loadCheckInSettings, clearCheckInRecords, calculateStats } from '../utils/checkinStorage';
import { useModal } from '../contexts/ModalContext';
import { THEME_OPTIONS } from '../theme';
import {
  AVATAR_THEME_OPTIONS,
  getAvatarFallbackUrlForParticipant,
  getAvatarUrlForParticipant,
} from '../avatarTheme';
import { 
  importParticipants,
  addParticipant,
  LuckEvent,
  getUserProjects,
  createProject,
  deleteProject,
  getOrCreateUser,
  getActiveEvent,
  clearCheckInRecordsForEvent,
  supabase
} from '../utils/supabaseCheckin';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  onParticipantsChange: (participants: Participant[]) => void;
  prizes: Prize[];
  onPrizesChange: (prizes: Prize[]) => void;
  records: DrawRecord[];
  onRecordsChange: (records: DrawRecord[]) => void;
  onUndoRecord: (recordId: string) => void;
  onClearAll: () => void;
  onOpenCheckInDisplay?: () => void;
  currentEventId?: string;
  onEventChange?: (eventId: string) => void;
  themeId: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
  customThemePalette: ThemePalette;
  onCustomThemePaletteChange: (palette: ThemePalette) => void;
  avatarThemeId: AvatarThemeId;
  onAvatarThemeChange: (avatarThemeId: AvatarThemeId) => void;
  backgroundMusic: BackgroundMusicSettings;
  onBackgroundMusicChange: (settings: BackgroundMusicSettings) => void;
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
}

type TabType = 'import' | 'prizes' | 'history' | 'export' | 'checkin' | 'theme';

const MUSIC_PRESETS = [
  {
    id: 'default',
    name: '默认抽奖音乐',
    src: 'https://file.unilumin-gtm.com/719dd328-3fee-4364-80a7-fb7a2a4e2881/1770371983248-%E6%8A%BD%E5%A5%96%E9%9F%B3%E4%B9%90.mp3',
  },
];

const AVATAR_PREVIEW_FALLBACK_PARTICIPANTS: Participant[] = [
  { id: 'A001', name: '王老师', dept: '教务处' },
  { id: 'A002', name: '李政务', dept: '行政中心' },
  { id: 'A003', name: '陈连长', dept: '保障部' },
  { id: 'A004', name: 'Mia', dept: '设计部' },
  { id: 'A005', name: 'Zhang Wei', dept: '产品部' },
  { id: 'A006', name: '刘晨', dept: '运营部' },
];

const SettingsPanel = ({
  isOpen,
  onClose,
  participants,
  onParticipantsChange,
  prizes,
  onPrizesChange,
  records,
  onRecordsChange: _onRecordsChange,
  onUndoRecord,
  onClearAll,
  onOpenCheckInDisplay,
  currentEventId,
  onEventChange,
  themeId,
  onThemeChange,
  customThemePalette,
  onCustomThemePaletteChange,
  avatarThemeId,
  onAvatarThemeChange,
  backgroundMusic,
  onBackgroundMusicChange,
  isMusicPlaying,
  onToggleMusic,
}: SettingsPanelProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 项目管理状态
  const [projects, setProjects] = useState<LuckEvent[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentEventId || null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  
  // 签到相关状态
  const [checkInSettings, setCheckInSettings] = useState<CheckInSettings>(DEFAULT_CHECKIN_SETTINGS);
  const [checkInStats, setCheckInStats] = useState({ checkedInCount: 0, checkInPercentage: 0, dbParticipantCount: 0 });

  // 名单查看和添加成员状态
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [participantsSearchQuery, setParticipantsSearchQuery] = useState('');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMember, setNewMember] = useState({ id: '', name: '', dept: '' });
  const backgroundMusicInputRef = useRef<HTMLInputElement>(null);

  // 活动状态


  // 使用内部弹窗
  const { showSuccess, showWarning, showError, showConfirm } = useModal();

  // 用于导入预览的状态
  const [previewFile, setPreviewFile] = useState<{ headers: string[], data: any[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState({ id: '', name: '', dept: '', avatar: '' });

  // LocalStorage 键名
  const LAST_EVENT_KEY = 'luck_last_event_id';

  // 加载项目列表 - 混合关联策略
  // 优先级：1. 父组件传入的 currentEventId → 2. URL参数 → 3. LocalStorage缓存 → 4. 全局活跃活动
  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      let availableProjects: LuckEvent[] = [];
      let preferredEventId: string | null = null;

      // 策略1：已登录用户 - 获取用户关联的项目
      if (user) {
        const luckUser = await getOrCreateUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name
        });
        if (luckUser) {
          availableProjects = await getUserProjects(luckUser.id);
        }
      }
      
      // 最高优先级：父组件传入的 currentEventId（来自路由参数）
      if (currentEventId) {
        preferredEventId = currentEventId;
        console.log('🎯 使用父组件传入的活动ID:', currentEventId);
      }
      
      // 策略2：检查 URL 参数中的 event ID
      if (!preferredEventId) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlEventId = urlParams.get('event');
        if (urlEventId) {
          preferredEventId = urlEventId;
          console.log('📍 从URL参数获取活动ID:', urlEventId);
        }
      }
      
      // 策略3：检查 LocalStorage 中缓存的上次活动
      if (!preferredEventId) {
        const cachedEventId = localStorage.getItem(LAST_EVENT_KEY);
        if (cachedEventId) {
          preferredEventId = cachedEventId;
          console.log('💾 从LocalStorage获取活动ID:', cachedEventId);
        }
      }
      
      // 策略4：未登录或无项目时，获取全局活跃活动
      if (availableProjects.length === 0) {
        const activeEvent = await getActiveEvent();
        if (activeEvent) {
          availableProjects.push(activeEvent);
          // 如果没有首选活动，使用全局活跃活动
          if (!preferredEventId) {
            preferredEventId = activeEvent.id;
            console.log('🌍 使用全局活跃活动:', activeEvent.name);
          }
        }
      }

      setProjects(availableProjects);

      // 确定最终选中的项目
      let finalSelectedId: string | null = null;
      
      if (preferredEventId && availableProjects.find(p => p.id === preferredEventId)) {
        // 首选活动在可用列表中
        finalSelectedId = preferredEventId;
      } else if (availableProjects.length > 0) {
        // 默认选择第一个可用项目
        finalSelectedId = availableProjects[0].id;
      }
      
      // 更新选中状态 — 仅当确实需要切换时才触发 onEventChange
      if (finalSelectedId) {
        setSelectedProjectId(finalSelectedId);
        // 持久化到 LocalStorage
        localStorage.setItem(LAST_EVENT_KEY, finalSelectedId);
        // 仅当与父组件的 currentEventId 不同时才通知导航（避免循环跳转）
        if (finalSelectedId !== currentEventId) {
          onEventChange?.(finalSelectedId);
        }
        console.log('✅ 已关联活动:', finalSelectedId);
      } else {
        setSelectedProjectId(null);
        localStorage.removeItem(LAST_EVENT_KEY);
      }
    } catch (err) {
      console.error('加载项目失败:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // 创建新项目
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showWarning('请输入项目名称');
      return;
    }
    setCreatingProject(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const luckUser = await getOrCreateUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name
        });
        if (luckUser) {
          const newProject = await createProject(luckUser.id, { name: newProjectName.trim() });
          if (newProject) {
            setProjects(prev => [...prev, newProject]);
            setSelectedProjectId(newProject.id);
            onEventChange?.(newProject.id);
            showSuccess('项目创建成功！');
            setNewProjectName('');
            setShowNewProjectInput(false);
          }
        }
      }
    } catch (err) {
      showError('创建项目失败');
      console.error(err);
    } finally {
      setCreatingProject(false);
    }
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string) => {
    const confirmed = await showConfirm('确定要删除此项目吗？所有相关数据将被清除。');
    if (!confirmed) return;
    
    try {
      const success = await deleteProject(projectId);
      if (success) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (selectedProjectId === projectId) {
          const remaining = projects.filter(p => p.id !== projectId);
          if (remaining.length > 0) {
            setSelectedProjectId(remaining[0].id);
            onEventChange?.(remaining[0].id);
          } else {
            setSelectedProjectId(null);
          }
        }
        showSuccess('项目已删除');
      }
    } catch (err) {
      showError('删除项目失败');
      console.error(err);
    }
  };

  // 选择项目
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    onEventChange?.(projectId);
    // 持久化到 LocalStorage，下次访问时自动关联
    localStorage.setItem(LAST_EVENT_KEY, projectId);
    console.log('📌 已切换并保存活动:', projectId);
  };

  // 初始化加载
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // 当选中项目变化时加载数据（包括签到统计）
  useEffect(() => {
    if (selectedProjectId) {
      loadCheckInData();
    }
  }, [selectedProjectId]);

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const { headers, data } = await parseExcelFile(file);
      
      if (headers.length === 0 || data.length === 0) {
        showWarning('文件内容为空或格式不正确');
        return;
      }

      setPreviewFile({ headers, data });
      
      const autoMapping = {
        id: headers.find(h => ['工号', 'ID', 'id', 'EmployeeID', '工号/ID'].includes(h)) || headers[0] || '',
        name: headers.find(h => ['姓名', 'Name', 'name', '员工姓名'].includes(h)) || headers[1] || '',
        dept: headers.find(h => ['部门', '组织', 'Dept', 'Department', '部门/组织'].includes(h)) || '',
        avatar: headers.find(h => ['头像', '头像URL', 'Avatar', 'avatar', 'photo', '图片'].includes(h)) || '',
      };
      setColumnMapping(autoMapping);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '无法解析 Excel 文件';
      showError(errorMessage);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 确认导入
  const confirmImport = async () => {
    if (!previewFile) return;
    if (!columnMapping.name) {
      showWarning('请至少选择"姓名"对应的列');
      return;
    }

    const imported = processImportData(previewFile.data, columnMapping);
    if (imported.length === 0) {
      showError('未能提取到有效数据，请检查映射关系');
      return;
    }
    
    onParticipantsChange(imported);
    
    if (selectedProjectId) {
      // Syncing start removed
      try {
        const dbData = imported.map(p => ({
          employee_id: p.id,
          name: p.name,
          department: p.dept,
        }));
        
        const result = await importParticipants(selectedProjectId, dbData);
        
        if (result.success) {
          showSuccess(`成功导入 ${imported.length} 名参与者，已同步到数据库！`);
          setCheckInStats(prev => ({ ...prev, dbParticipantCount: result.count }));
        } else {
          showWarning(`本地导入成功，但同步到数据库失败：${result.error}`);
        }
      } catch (err) {
        showWarning('本地导入成功，但同步到数据库时发生错误');
      } finally {
        // Syncing end removed
      }
    } else {
      showSuccess(`成功导入 ${imported.length} 名参与者！(未选择项目，仅保存本地)`);
    }
    
    setPreviewFile(null);
  };

  const cancelPreview = () => {
    setPreviewFile(null);
    setColumnMapping({ id: '', name: '', dept: '', avatar: '' });
  };

  // 成员管理操作
  const handleAddMember = async () => {
    if (!newMember.name.trim()) {
      showWarning('请输入姓名');
      return;
    }
    
    const memberId = newMember.id.trim() || `auto_${Date.now()}`;
    
    // 检查是否已存在
    if (participants.some(p => p.id === memberId)) {
      showWarning('该工号已存在');
      return;
    }
    
    const member: Participant = {
      id: memberId,
      name: newMember.name.trim(),
      dept: newMember.dept.trim() || '未分配',
    };
    
    const updatedParticipants = [...participants, member];
    onParticipantsChange(updatedParticipants);
    
    // 如果有选中项目，同步到数据库
    if (selectedProjectId) {
      try {
        const result = await addParticipant(selectedProjectId, {
          employee_id: member.id,
          name: member.name,
          department: member.dept,
        });
        
        if (result.success) {
          showSuccess(`已添加成员 "${member.name}" 并同步到云端`);
        } else {
          showWarning(`已添加成员 "${member.name}"，但同步云端失败：${result.error}`);
        }
      } catch (err) {
        showWarning(`已添加成员 "${member.name}"，但同步云端失败`);
      }
    } else {
      showSuccess(`已添加成员 "${member.name}"`);
    }
    
    // 重置表单
    setNewMember({ id: '', name: '', dept: '' });
    setShowAddMemberForm(false);
  };

  const handleBackgroundMusicUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      showWarning('请选择音频文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onBackgroundMusicChange({
        ...backgroundMusic,
        src: String(reader.result),
        name: file.name,
        presetId: 'custom',
      });
      if (backgroundMusicInputRef.current) {
        backgroundMusicInputRef.current.value = '';
      }
      showSuccess('背景音乐已上传');
    };
    reader.onerror = () => {
      showError('读取音频失败');
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundMusicClear = () => {
    onBackgroundMusicChange({
      ...backgroundMusic,
      src: '',
      name: '',
      presetId: '',
    });
    if (backgroundMusicInputRef.current) {
      backgroundMusicInputRef.current.value = '';
    }
  };

  const handleBackgroundMusicPresetChange = (presetId: string) => {
    if (!presetId) {
      handleBackgroundMusicClear();
      return;
    }
    if (presetId === 'custom') {
      onBackgroundMusicChange({
        ...backgroundMusic,
        src: '',
        name: '',
        presetId: 'custom',
      });
      if (backgroundMusicInputRef.current) {
        backgroundMusicInputRef.current.value = '';
      }
      return;
    }
    const preset = MUSIC_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    onBackgroundMusicChange({
      ...backgroundMusic,
      src: preset.src,
      name: preset.name,
      presetId: preset.id,
    });
  };

  const handleDeleteMember = async (memberId: string) => {
    const member = participants.find(p => p.id === memberId);
    if (!member) return;
    
    const confirmed = await showConfirm(`确定要删除成员 "${member.name}" 吗？`);
    if (!confirmed) return;
    
    const updatedParticipants = participants.filter(p => p.id !== memberId);
    onParticipantsChange(updatedParticipants);
    
    // TODO: 如果需要同步删除云端数据，在这里添加
    showSuccess(`已删除成员 "${member.name}"`);
  };

  // 过滤后的参与者列表
  const filteredParticipants = participants.filter(p => {
    const query = participantsSearchQuery.toLowerCase();
    return p.name.toLowerCase().includes(query) || 
           p.id.toLowerCase().includes(query) ||
           p.dept.toLowerCase().includes(query);
  });

  // 奖项操作
  const addPrize = () => {
    const newPrize: Prize = {
      id: `prize_${Date.now()}`,
      name: `奖项${prizes.length + 1}`,
      count: 1,
      description: '',
      drawn: 0,
    };
    onPrizesChange([...prizes, newPrize]);
  };

  const updatePrize = (id: string, field: keyof Prize, value: string | number) => {
    onPrizesChange(
      prizes.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  const deletePrize = (id: string) => {
    if (prizes.length <= 1) {
      showWarning('至少保留一个奖项');
      return;
    }
    onPrizesChange(prizes.filter(p => p.id !== id));
  };

  // 签到数据
  const loadCheckInData = async () => {
    const settings = loadCheckInSettings();
    setCheckInSettings(settings);

    // 优先从数据库获取签到统计
    if (selectedProjectId) {
      try {
        const { getCheckInCount, getParticipantCount } = await import('../utils/supabaseCheckin');
        const checkedInCount = await getCheckInCount(selectedProjectId);
        const totalParticipants = await getParticipantCount(selectedProjectId);
        const total = totalParticipants || participants.length || 1;
        setCheckInStats({
          checkedInCount,
          checkInPercentage: Math.round((checkedInCount / total) * 100),
          dbParticipantCount: totalParticipants,
        });
      } catch (err) {
        console.error('从数据库获取签到统计失败:', err);
        // fallback 到本地
        const stats = calculateStats();
        setCheckInStats({ checkedInCount: stats.checkedInCount, checkInPercentage: stats.checkInPercentage, dbParticipantCount: 0 });
      }
    } else {
      const stats = calculateStats();
      setCheckInStats({ checkedInCount: stats.checkedInCount, checkInPercentage: stats.checkInPercentage, dbParticipantCount: 0 });
    }
  };

  const updateCheckInSettings = (updates: Partial<CheckInSettings>) => {
    const newSettings = { ...checkInSettings, ...updates };
    setCheckInSettings(newSettings);
    saveCheckInSettings(newSettings);
  };

  const handleClearCheckInRecords = async () => {
    // 增加二次确认避免误操作
    const confirmed = await showConfirm(
      selectedProjectId 
        ? '确定要清除当前项目的所有云端及本地签到记录吗？此操作不可恢复。' 
        : '确定要清除所有本地签到记录吗？此操作不可恢复。'
    );
    
    if (confirmed) {
      setLoadingProjects(true); // 使用 loading 状态
      try {
        if (selectedProjectId) {
          // 清除云端数据
          const { clearCheckInRecordsForEvent } = await import('../utils/supabaseCheckin');
          const success = await clearCheckInRecordsForEvent(selectedProjectId);
          
          if (success) {
            // 清除本地缓存
            clearCheckInRecords();
            loadCheckInData();
            setCheckInStats(prev => ({ ...prev, checkedInCount: 0, checkInPercentage: 0 }));
            showSuccess('已清除当前项目的云端及本地签到记录');
          } else {
            showError('云端记录清除失败，请重试');
          }
        } else {
          // 仅清除本地
          clearCheckInRecords();
          loadCheckInData();
          showSuccess('本地签到记录已清除');
        }
      } catch (err) {
        console.error('清除记录失败:', err);
        showError('清除记录时发生错误');
      } finally {
        setLoadingProjects(false);
      }
    }
  };

  // Tab 配置
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'import', label: '导入名单', icon: <Upload size={18} /> },
    { id: 'prizes', label: '奖项设置', icon: <Award size={18} /> },
    { id: 'theme', label: '主题配色', icon: <Palette size={18} /> },
    { id: 'checkin', label: '签到', icon: <QrCode size={18} /> },
    { id: 'history', label: '历史', icon: <History size={18} /> },
    { id: 'export', label: '导出', icon: <Download size={18} /> },
  ];

  const lightThemes = THEME_OPTIONS.filter(theme => theme.category === 'light' && theme.id !== 'custom');
  const darkThemes = THEME_OPTIONS.filter(theme => theme.category === 'dark' && theme.id !== 'custom');
  const functionalThemes = THEME_OPTIONS.filter(theme => theme.category === 'functional');

  const handleCustomColorChange = (field: keyof ThemePalette, value: string) => {
    onCustomThemePaletteChange({
      ...customThemePalette,
      [field]: value,
    });
    onThemeChange('custom');
  };

  const applyPresetToCustom = (presetId: ThemeId) => {
    const preset = THEME_OPTIONS.find(theme => theme.id === presetId);
    if (!preset) return;
    onCustomThemePaletteChange({ ...preset.palette });
    onThemeChange('custom');
    showSuccess(`已复制「${preset.name}」到自定义色盘`);
  };

  const renderThemeCard = (theme: typeof THEME_OPTIONS[number]) => (
    <button
      key={theme.id}
      onClick={() => onThemeChange(theme.id)}
      className={`w-full p-3 rounded-xl border text-left transition-all ${
        themeId === theme.id
          ? 'border-[var(--color-primary)] bg-[color:rgb(var(--color-primary-rgb)/0.12)] shadow-[0_10px_24px_rgb(var(--color-primary-rgb)/0.2)]'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-white">{theme.name}</div>
          <div className="text-xs text-gray-400 mt-1">{theme.description}</div>
        </div>
        {themeId === theme.id && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary)] text-white">
            当前
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        {[
          (theme.id === 'custom' ? customThemePalette : theme.palette).primary,
          (theme.id === 'custom' ? customThemePalette : theme.palette).secondary,
          (theme.id === 'custom' ? customThemePalette : theme.palette).accent,
          (theme.id === 'custom' ? customThemePalette : theme.palette).bgBase,
          (theme.id === 'custom' ? customThemePalette : theme.palette).bgDeep,
        ].map((color, idx) => (
          <span
            key={`${theme.id}-${idx}`}
            className="w-5 h-5 rounded-full border border-white/20"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </button>
  );

  const avatarPreviewParticipants = (
    participants.length > 0 ? participants.slice(0, 6) : AVATAR_PREVIEW_FALLBACK_PARTICIPANTS
  ).map((participant, index) => ({
    id: participant.id || `preview-${index + 1}`,
    name: participant.name || `用户${index + 1}`,
    dept: participant.dept || '未分配',
    avatar: undefined,
  }));

  const handleAvatarImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const fallback = img.dataset.fallback;
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    }
  };

  const renderAvatarThemeCard = (theme: typeof AVATAR_THEME_OPTIONS[number]) => (
    <button
      key={theme.id}
      onClick={() => onAvatarThemeChange(theme.id)}
      className={`w-full p-3 rounded-xl border text-left transition-all ${
        avatarThemeId === theme.id
          ? 'border-[var(--color-primary)] bg-[color:rgb(var(--color-primary-rgb)/0.12)] shadow-[0_10px_24px_rgb(var(--color-primary-rgb)/0.2)]'
          : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-white">{theme.name}</div>
          <div className="text-xs text-gray-400 mt-1">{theme.description}</div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-200 uppercase">
          {theme.provider}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {avatarThemeId === theme.id ? (
          avatarPreviewParticipants.slice(0, 3).map((participant) => (
            <img
              key={`${theme.id}-${participant.id}`}
              src={getAvatarUrlForParticipant(participant, theme.id)}
              data-fallback={getAvatarFallbackUrlForParticipant(participant, theme.id)}
              onError={handleAvatarImageError}
              alt={participant.name}
              className="w-8 h-8 rounded-full border border-white/20 bg-white/10 object-cover"
            />
          ))
        ) : (
          <span className="text-[11px] text-gray-500">点击后加载预览</span>
        )}
      </div>
    </button>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 左侧项目管理面板 */}
      <div className="relative w-64 h-full bg-[#0a0820]/95 backdrop-blur-xl border-r border-white/10 flex flex-col animate-slide-in-left z-10">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <FolderOpen size={20} className="text-[#b63cfa]" />
            项目管理
          </div>
        </div>
        
        {/* 项目列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingProjects ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : !currentUser ? (
             // 未登录状态
            <div className="flex flex-col items-center justify-center py-10 px-4 space-y-4 text-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                <LogIn size={20} className="text-gray-400 ml-1" />
              </div>
              <div>
                <p className="text-gray-300 font-medium mb-1">登录管理项目</p>
                <p className="text-xs text-gray-500">登录后可创建和同步云端项目</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2 bg-[#3c80fa] hover:bg-[#3c80fa]/80 text-white rounded-lg text-sm font-bold transition-all"
              >
                立即登录
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无项目，请创建一个
            </div>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                  selectedProjectId === project.id
                    ? 'bg-gradient-to-r from-[#3c80fa]/20 to-[#b63cfa]/20 border border-[#3c80fa]/50'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
                onClick={() => handleSelectProject(project.id)}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium truncate ${
                    selectedProjectId === project.id ? 'text-white' : 'text-gray-300'
                  }`}>
                    {project.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(project.created_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))
          )}
        </div>
        

        
        {/* 新建项目 & 用户信息 - 仅登录可见 */}
        {currentUser && (
          <div className="p-3 border-t border-white/10 flex flex-col gap-3">
            {showNewProjectInput ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="项目名称"
                  className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#3c80fa]"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewProjectInput(false)}
                    className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-white/5 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={creatingProject}
                    className="flex-1 py-2 text-sm text-white bg-[#3c80fa] hover:bg-[#3c80fa]/80 rounded-lg disabled:opacity-50"
                  >
                    {creatingProject ? '创建中...' : '创建'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewProjectInput(true)}
                className="w-full py-2.5 border-2 border-dashed border-white/20 text-gray-400 text-sm rounded-xl hover:border-[#3c80fa] hover:text-[#3c80fa] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                新建项目
              </button>
            )}

            {/* 用户信息 & 退出 */}
            <div className="flex items-center justify-between px-1 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {currentUser.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-white font-medium truncate max-w-[100px]">{currentUser.user_metadata?.name || currentUser.email?.split('@')[0]}</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                    setProjects([]);
                    setSelectedProjectId(null);
                    showSuccess('已退出登录');
                  } catch (e) {
                    console.error('Logout error', e);
                  }
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="退出登录"
              >
                <LogIn size={16} className="rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 右侧设置面板 */}
      <div className="relative ml-auto w-full max-w-3xl h-full bg-[#0f0c29]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">设置</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              重置数据
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* 当前项目提示 */}
        {selectedProjectId && (
          <div className="px-4 py-2 bg-[#3c80fa]/10 border-b border-[#3c80fa]/20">
            <span className="text-xs text-gray-400">当前项目：</span>
            <span className="text-sm text-white ml-1 font-medium">
              {projects.find(p => p.id === selectedProjectId)?.name || '未知'}
            </span>
          </div>
        )}

        {/* Tab 导航 */}
        <div className="flex border-b border-white/10">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all
                ${activeTab === tab.id 
                  ? 'text-[#3c80fa] border-b-2 border-[#3c80fa] bg-[#3c80fa]/10' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 导入名单 */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {!previewFile ? (
                <>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-[#3c80fa]" />
                        <span className="font-medium text-white">当前名单</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowParticipantsList(!showParticipantsList)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="查看名单"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                          className="p-1.5 hover:bg-[#3c80fa]/20 rounded-lg transition-colors text-[#3c80fa]"
                          title="添加成员"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">{participants.length} <span className="text-sm font-normal text-gray-400">人</span></p>
                    <p className="text-xs text-gray-500">支持 .xlsx, .xls 格式</p>
                    
                    {/* 添加成员表单 */}
                    {showAddMemberForm && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fade-in">
                        <div className="flex items-center gap-2 text-sm text-white font-medium">
                          <UserPlus size={14} className="text-[#3c80fa]" />
                          添加成员
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newMember.name}
                            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                            placeholder="姓名 *"
                            className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#3c80fa]"
                          />
                          <input
                            type="text"
                            value={newMember.id}
                            onChange={(e) => setNewMember({ ...newMember, id: e.target.value })}
                            placeholder="工号 (选填)"
                            className="px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#3c80fa]"
                          />
                        </div>
                        <input
                          type="text"
                          value={newMember.dept}
                          onChange={(e) => setNewMember({ ...newMember, dept: e.target.value })}
                          placeholder="部门 (选填)"
                          className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#3c80fa]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setShowAddMemberForm(false);
                              setNewMember({ id: '', name: '', dept: '' });
                            }}
                            className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-white/5 rounded-lg transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleAddMember}
                            className="flex-1 py-2 text-sm text-white bg-[#3c80fa] hover:bg-[#3c80fa]/80 rounded-lg transition-colors font-medium"
                          >
                            添加
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* 名单列表 */}
                    {showParticipantsList && (
                      <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                              type="text"
                              value={participantsSearchQuery}
                              onChange={(e) => setParticipantsSearchQuery(e.target.value)}
                              placeholder="搜索姓名、工号或部门..."
                              className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#3c80fa]"
                            />
                          </div>
                        </div>
                        
                        <div className="max-h-80 overflow-y-auto space-y-1 custom-scrollbar">
                          {filteredParticipants.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 text-sm">
                              {participantsSearchQuery ? '未找到匹配的成员' : '暂无成员'}
                            </div>
                          ) : (
                            filteredParticipants.map((p, idx) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between px-3 py-2 bg-black/20 hover:bg-white/5 rounded-lg group transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xs text-gray-600 w-6 shrink-0">{idx + 1}</span>
                                  <div className="min-w-0">
                                    <div className="text-sm text-white truncate">{p.name}</div>
                                    <div className="text-xs text-gray-500 truncate">
                                      {p.id} · {p.dept}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteMember(p.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded transition-all"
                                >
                                  <Trash2 size={12} className="text-red-400" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        {filteredParticipants.length > 0 && (
                          <div className="text-center pt-2 text-xs text-gray-500 border-t border-white/5 mt-2">
                            {participantsSearchQuery 
                              ? `搜索结果：${filteredParticipants.length} 人` 
                              : `共 ${filteredParticipants.length} 人`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-[#b63cfa]" />
                        <span className="font-medium text-white">背景音乐</span>
                      </div>
                      
                    </div>
                    <p className="text-xs text-gray-500">
                      支持预设音乐或自定义上传，手动点击播放按钮即可循环播放。
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">预设音乐</label>
                      <select
                        value={backgroundMusic.presetId}
                        onChange={(e) => handleBackgroundMusicPresetChange(e.target.value)}
                        className="w-full bg-black/40 border border-white/20 rounded px-2 py-2 text-white text-sm focus:border-[#3c80fa] outline-none"
                      >
                        {MUSIC_PRESETS.map(preset => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                        <option value="custom">自定义上传</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={backgroundMusicInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={handleBackgroundMusicUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => backgroundMusicInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 text-gray-200 rounded-lg text-sm transition-colors"
                      >
                        {backgroundMusic.src ? '更换音频' : '上传音频'}
                      </button>
                    </div>
                    {backgroundMusic.name && (
                      <div className="text-xs text-gray-400 truncate">
                        当前文件：{backgroundMusic.name}
                      </div>
                    )}
                    <button
                      onClick={onToggleMusic}
                      disabled={!backgroundMusic.src}
                      className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors border border-white/10 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMusicPlaying ? '暂停播放' : '播放音乐'}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="w-full py-4 px-4 bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/20"
                  >
                    <Upload size={20} />
                    {importing ? '解析中...' : '选择 Excel 文件导入'}
                  </button>

                  <button
                    onClick={downloadTemplate}
                    className="w-full py-3 px-4 bg-white/5 text-gray-300 font-medium rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Download size={18} />
                    下载导入模板
                  </button>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex gap-2">
                       <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                       <div className="text-xs text-amber-200/80">
                         <p className="font-medium mb-1">文件说明：</p>
                         <ul className="list-disc list-inside space-y-0.5 text-amber-200/60">
                           <li>第一行必须是表头</li>
                           <li>导入后会完全覆盖当前名单</li>
                         </ul>
                       </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="animate-fade-in space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold">导入设置</h3>
                    <button onClick={cancelPreview} className="text-xs text-gray-400 hover:text-white">取消</button>
                  </div>

                  <div className="grid gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">选择姓名列 (必选)</label>
                      <select 
                        value={columnMapping.name}
                        onChange={e => setColumnMapping({...columnMapping, name: e.target.value})}
                        className="w-full bg-black/40 border border-white/20 rounded px-2 py-2 text-white text-sm focus:border-[#3c80fa] outline-none"
                      >
                         <option value="" disabled>请选择...</option>
                         {previewFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">选择工号列</label>
                        <select 
                          value={columnMapping.id}
                          onChange={e => setColumnMapping({...columnMapping, id: e.target.value})}
                          className="w-full bg-black/40 border border-white/20 rounded px-2 py-2 text-white text-sm focus:border-[#3c80fa] outline-none"
                        >
                           <option value="">(自动生成)</option>
                           {previewFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">选择部门列</label>
                        <select 
                          value={columnMapping.dept}
                          onChange={e => setColumnMapping({...columnMapping, dept: e.target.value})}
                          className="w-full bg-black/40 border border-white/20 rounded px-2 py-2 text-white text-sm focus:border-[#3c80fa] outline-none"
                        >
                           <option value="">(留空)</option>
                          {previewFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400">选择头像列 (可选)</label>
                        <select 
                          value={columnMapping.avatar}
                          onChange={e => setColumnMapping({...columnMapping, avatar: e.target.value})}
                          className="w-full bg-black/40 border border-white/20 rounded px-2 py-2 text-white text-sm focus:border-[#3c80fa] outline-none"
                        >
                           <option value="">(使用头像主题生成)</option>
                           {previewFile.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">前 5 行数据预览：</p>
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-left text-xs text-gray-400">
                        <thead className="bg-white/10 text-white font-bold">
                          <tr>
                            {previewFile.headers.map(h => (
                               <th key={h} className={`p-2 whitespace-nowrap ${[columnMapping.name, columnMapping.id, columnMapping.dept, columnMapping.avatar].includes(h) ? 'text-[#3c80fa]' : ''}`}>
                                 {h}
                                 {h === columnMapping.name && ' (姓名)'}
                                 {h === columnMapping.id && ' (工号)'}
                                 {h === columnMapping.avatar && ' (头像)'}
                               </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {previewFile.data.slice(0, 5).map((row, idx) => (
                            <tr key={idx}>
                              {previewFile.headers.map(h => (
                                <td key={h} className="p-2 border-r border-white/5 last:border-0 max-w-[100px] truncate">
                                  {row[h]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={cancelPreview}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors font-medium border border-white/10"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmImport}
                      className="flex-[2] py-3 bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                    >
                      确认导入 ({previewFile.data.length}人)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 奖项设置 */}
          {activeTab === 'prizes' && (
            <div className="space-y-3">
              {prizes.map((prize, idx) => (
                <div 
                  key={prize.id}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-[#b63cfa] to-[#573cfa] flex items-center justify-center text-xs font-bold text-white">
                          {idx + 1}
                        </div>
                        <input
                          type="text"
                          value={prize.name}
                          onChange={(e) => updatePrize(prize.id, 'name', e.target.value)}
                          className="w-full bg-transparent text-white font-bold text-lg border-b border-white/10 focus:border-[#3c80fa] outline-none py-1 placeholder-gray-600"
                          placeholder="奖项名称 (如: 特等奖)"
                        />
                      </div>
                      
                      <input
                        type="text"
                        value={prize.description || ''}
                        onChange={(e) => updatePrize(prize.id, 'description', e.target.value)}
                        className="w-full bg-transparent text-sm text-gray-300 border-b border-white/10 focus:border-[#3c80fa] outline-none py-1 placeholder-gray-600 ml-8"
                        placeholder="奖品描述 (如: Macbook Pro)"
                      />

                      <div className="flex items-center gap-2 ml-8">
                         <div 
                           className="relative w-10 h-10 rounded bg-black/40 overflow-hidden shrink-0 border border-white/10 group cursor-pointer"
                           onClick={() => document.getElementById(`upload-${prize.id}`)?.click()}
                         >
                           {prize.image ? (
                             <>
                               <img src={prize.image} alt="" className="w-full h-full object-cover" />
                               <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Plus size={12} className="text-white" />
                               </div>
                             </>
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-600 hover:text-white transition-colors">
                               <Plus size={14} />
                             </div>
                           )}
                         </div>
                         
                         <div className="flex flex-col justify-center">
                            <button
                              onClick={() => document.getElementById(`upload-${prize.id}`)?.click()}
                              className="text-xs text-[#3c80fa] hover:text-[#573cfa] text-left font-medium transition-colors"
                            >
                              {prize.image ? '更换图片' : '上传图片'}
                            </button>
                            <span className="text-[10px] text-gray-600">支持 jpg, png, webp</span>
                         </div>

                         <input
                            id={`upload-${prize.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  updatePrize(prize.id, 'image', reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                         />
                      </div>
                    </div>

                    <button
                      onClick={() => deletePrize(prize.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-sm text-gray-400">名额数量</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updatePrize(prize.id, 'count', Math.max(1, prize.count - 1))}
                        className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                      >
                        <Minus size={14} className="text-white" />
                      </button>
                      <span className="w-12 text-center text-white font-bold">{prize.count}</span>
                      <button
                        onClick={() => updatePrize(prize.id, 'count', prize.count + 1)}
                        className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                      >
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">已抽取</span>
                    <span className={prize.drawn >= prize.count ? 'text-green-400' : 'text-[#b63cfa]'}>
                      {prize.drawn} / {prize.count}
                    </span>
                  </div>
                </div>
              ))}
              
              <button
                onClick={addPrize}
                className="w-full py-3 px-4 border-2 border-dashed border-white/20 text-gray-400 font-medium rounded-xl hover:border-[#3c80fa] hover:text-[#3c80fa] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                添加奖项
              </button>
            </div>
          )}

          {/* 主题配色 */}
          {activeTab === 'theme' && (
            <div className="space-y-5">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={18} className="text-[var(--color-accent)]" />
                  <span className="font-medium text-white">主题与色盘</span>
                </div>
                <p className="text-xs text-gray-400">
                  预设可一键切换，色盘支持你手动调主色/辅色/强调色/背景色。调色后会自动切换到“自定义色盘”。
                </p>
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white">浅色与亮色</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lightThemes.map(renderThemeCard)}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white">深色主题</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {darkThemes.map(renderThemeCard)}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white">功能型主题</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {functionalThemes.map(renderThemeCard)}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white">人物头像主题</h3>
                <p className="text-xs text-gray-400">
                  支持多头像 API 风格切换。若成员有自定义头像 URL，将优先使用自定义头像。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVATAR_THEME_OPTIONS.map(renderAvatarThemeCard)}
                </div>
              </section>

              <section className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">头像预览</h3>
                  <span className="text-xs text-gray-400">当前：{AVATAR_THEME_OPTIONS.find(item => item.id === avatarThemeId)?.name || '默认'}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {avatarPreviewParticipants.map((participant) => (
                    <div key={`preview-${participant.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/10">
                      <img
                        src={getAvatarUrlForParticipant(participant, avatarThemeId)}
                        data-fallback={getAvatarFallbackUrlForParticipant(participant, avatarThemeId)}
                        onError={handleAvatarImageError}
                        alt={participant.name}
                        className="w-10 h-10 rounded-full border border-white/20 bg-white/10 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{participant.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{participant.dept}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">自定义色盘</h3>
                    <p className="text-xs text-gray-400 mt-1">可在预设基础上微调颜色，适配不同场地与屏幕。</p>
                  </div>
                  <button
                    onClick={() => onThemeChange('custom')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
                  >
                    启用自定义
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    { key: 'primary', label: '主色' },
                    { key: 'secondary', label: '辅色' },
                    { key: 'accent', label: '强调色' },
                    { key: 'bgBase', label: '背景浅层' },
                    { key: 'bgDeep', label: '背景深层' },
                  ] as Array<{ key: keyof ThemePalette; label: string }>).map(item => (
                    <div key={item.key} className="p-3 rounded-lg bg-black/20 border border-white/10">
                      <label className="block text-xs text-gray-400 mb-2">{item.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customThemePalette[item.key]}
                          onChange={(e) => handleCustomColorChange(item.key, e.target.value)}
                          className="w-10 h-10 p-0 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customThemePalette[item.key]}
                          readOnly
                          className="flex-1 px-2 py-2 bg-black/30 border border-white/15 rounded text-white text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {THEME_OPTIONS.filter(theme => theme.id !== 'custom').map(theme => (
                    <button
                      key={`clone-${theme.id}`}
                      onClick={() => applyPresetToCustom(theme.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-white/10 text-gray-200 hover:bg-white/20 transition-colors"
                    >
                      用「{theme.name}」做底色
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* 历史记录 */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {records.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History size={48} className="mx-auto mb-3 opacity-30" />
                  <p>暂无抽奖记录</p>
                </div>
              ) : (
                records.map((record) => (
                  <div 
                    key={record.id}
                    className="p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[#b63cfa] font-medium">{record.prizeName}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {new Date(record.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>
                      <button
                        onClick={() => onUndoRecord(record.id)}
                        className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw size={12} />
                        撤销
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {record.winners.map((winner) => (
                        <div 
                          key={winner.id}
                          className="flex items-center gap-2 bg-black/30 px-2 py-1 rounded-full"
                        >
                          <img 
                            src={getAvatarUrlForParticipant(winner, avatarThemeId)}
                            data-fallback={getAvatarFallbackUrlForParticipant(winner, avatarThemeId)}
                            onError={handleAvatarImageError}
                            alt="" 
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-xs text-white">{winner.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 签到设置 */}
          {activeTab === 'checkin' && (
            <div className="space-y-4">
              {onOpenCheckInDisplay && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCheckInDisplay();
                  }}
                  className="w-full flex items-center justify-between px-5 py-5 bg-gradient-to-r from-green-500/20 via-emerald-600/15 to-teal-500/10 rounded-2xl border border-green-500/30 hover:border-green-500/50 transition-all group shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                      <Monitor size={24} className="text-white" />
                    </div>
                    <div className="text-left">
                      <span className="text-white font-bold text-lg block">打开签到大屏</span>
                      <span className="text-gray-400 text-sm">实时展示签到动态</span>
                    </div>
                  </div>
                  <ChevronRight size={24} className="text-green-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}

              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <QrCode size={18} className="text-green-400" />
                  <span className="font-medium text-white">签到统计</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{participants.length}</p>
                    <p className="text-xs text-gray-500">总人数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{checkInStats.checkedInCount}</p>
                    <p className="text-xs text-gray-500">已签到</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{checkInStats.checkInPercentage}%</p>
                    <p className="text-xs text-gray-500">签到率</p>
                  </div>
                </div>
                <button
                  onClick={loadCheckInData}
                  className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  刷新统计
                </button>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-yellow-400" />
                  <span className="font-medium text-white text-sm">活动配置</span>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">活动名称</label>
                  <input
                    type="text"
                    value={checkInSettings.eventName}
                    onChange={(e) => updateCheckInSettings({ eventName: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                    placeholder="例如：2026年度盛典"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">活动日期</label>
                  <input
                    type="date"
                    value={checkInSettings.eventDate}
                    onChange={(e) => updateCheckInSettings({ eventDate: e.target.value })}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-green-500/50"
                  />
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-blue-400" />
                    <span className="font-medium text-white text-sm">位置验证</span>
                  </div>
                  <button
                    onClick={() => updateCheckInSettings({ requireLocation: !checkInSettings.requireLocation })}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      checkInSettings.requireLocation ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      checkInSettings.requireLocation ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  开启后，签到时将验证用户地理位置
                </p>
                
                {checkInSettings.requireLocation && (
                  <div className="pt-2 space-y-2">
                    <input
                      type="text"
                      value={checkInSettings.locationName || ''}
                      onChange={(e) => updateCheckInSettings({ locationName: e.target.value })}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                      placeholder="活动地点名称"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.000001"
                        value={checkInSettings.locationLat || ''}
                        onChange={(e) => updateCheckInSettings({ locationLat: parseFloat(e.target.value) || undefined })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                        placeholder="纬度"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={checkInSettings.locationLng || ''}
                        onChange={(e) => updateCheckInSettings({ locationLng: parseFloat(e.target.value) || undefined })}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                        placeholder="经度"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              updateCheckInSettings({
                                locationLat: pos.coords.latitude,
                                locationLng: pos.coords.longitude,
                              });
                              showSuccess(`已获取当前位置`);
                            },
                            (err) => showError('获取位置失败：' + err.message)
                          );
                        }
                      }}
                      className="w-full py-2 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
                    >
                      获取当前位置
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 size={16} className="text-purple-400" />
                  <span className="font-medium text-white text-sm">大屏配置</span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-400">显示签到二维码</span>
                  <button
                    onClick={() => updateCheckInSettings({ showQRCode: !checkInSettings.showQRCode })}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      checkInSettings.showQRCode ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      checkInSettings.showQRCode ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-white/5">
                  <span className="text-sm text-gray-400">显示部门统计</span>
                  <button
                    onClick={() => updateCheckInSettings({ showDepartmentStats: !checkInSettings.showDepartmentStats })}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      checkInSettings.showDepartmentStats ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      checkInSettings.showDepartmentStats ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <label className="block text-xs text-gray-400 mb-2">动画风格</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['slide', 'fade', 'bounce'] as const).map(style => (
                      <button
                        key={style}
                        onClick={() => updateCheckInSettings({ animationStyle: style })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          checkInSettings.animationStyle === style
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 border'
                            : 'bg-white/5 border-white/10 text-gray-400 border hover:bg-white/10'
                        }`}
                      >
                        {style === 'slide' ? '滑入' : style === 'fade' ? '淡入' : '弹入'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <button
                  onClick={handleClearCheckInRecords}
                  className="w-full py-2.5 px-4 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 border border-red-500/30"
                >
                  <Trash2 size={16} />
                  清除签到记录
                </button>
                <p className="text-xs text-gray-600 text-center mt-2">
                  提示：参与者名单使用"导入名单"中的数据
                </p>
              </div>
            </div>
          )}

          {/* 数据导出 */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Award size={20} className="text-[#b63cfa]" />
                  <span className="font-medium text-white">抽奖统计</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-white">{participants.length}</p>
                    <p className="text-xs text-gray-500">总人数</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#b63cfa]">
                      {records.reduce((sum, r) => sum + r.winners.length, 0)}
                    </p>
                    <p className="text-xs text-gray-500">已中奖</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#3c80fa]">
                      {participants.length > 0 
                        ? ((records.reduce((sum, r) => sum + r.winners.length, 0) / participants.length) * 100).toFixed(1)
                        : 0}%
                    </p>
                    <p className="text-xs text-gray-500">中奖率</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{records.length}</p>
                    <p className="text-xs text-gray-500">抽奖轮次</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const success = exportWinnersToExcel(records);
                  if (!success) {
                    showWarning('暂无中奖记录可导出');
                  }
                }}
                disabled={records.length === 0}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={18} />
                导出中奖名单 (Excel)
              </button>

              <div className="border-t border-white/10 pt-4 mt-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">危险操作</h3>
                <button
                  onClick={async () => {
                    const confirmed = await showConfirm('确定要清除所有数据吗？此操作不可恢复！');
                    if (confirmed) {
                      try {
                        if (selectedProjectId) {
                          const { clearCheckInRecordsForEvent } = await import('../utils/supabaseCheckin');
                          await clearCheckInRecordsForEvent(selectedProjectId);
                          setCheckInStats(prev => ({ ...prev, checkedInCount: 0, checkInPercentage: 0 }));
                        }
                      } catch (e) {
                         console.error('Failed to clear cloud check-ins', e);
                      }
                      onClearAll();
                    }
                  }}
                  className="w-full py-3 px-4 bg-red-500/10 text-red-400 font-medium rounded-xl hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 border border-red-500/30"
                >
                  <Trash2 size={18} />
                  清除所有数据
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 重置确认弹窗 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          />
          
          <div className="relative bg-gradient-to-br from-[#1a1535] to-[#0f0c29] border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            
            <h3 className="text-xl font-bold text-white text-center mb-2">
              确认重置所有数据？
            </h3>
            
            <p className="text-gray-400 text-sm text-center mb-6">
              此操作将清除以下所有数据，且<span className="text-red-400 font-medium">无法恢复</span>：
            </p>
            
            <div className="bg-black/30 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span className="text-gray-300">参与者名单（{participants.length} 人）</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span className="text-gray-300">奖项配置（{prizes.length} 个奖项）</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span className="text-gray-300">抽奖记录（{records.length} 条记录）</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <span className="text-gray-300">已中奖名单</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-green-300">☁️ 云端签到记录（{checkInStats.checkedInCount} 人）</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  let cloudCleared = false;
                  
                  // 优先使用选中的项目，如果没有则尝试获取活跃活动
                  let eventIdToClear = selectedProjectId;
                  if (!eventIdToClear) {
                    try {
                      const activeEvent = await getActiveEvent();
                      if (activeEvent) {
                        eventIdToClear = activeEvent.id;
                      }
                    } catch (e) {
                      console.error('获取活跃活动失败:', e);
                    }
                  }
                  
                  if (eventIdToClear) {
                    try {
                      // 重置时同时清除云端签到数据
                      const success = await clearCheckInRecordsForEvent(eventIdToClear);
                      if (success) {
                        cloudCleared = true;
                        setCheckInStats(prev => ({ ...prev, checkedInCount: 0, checkInPercentage: 0 }));
                        console.log('✅ 云端签到记录已清除，活动ID:', eventIdToClear);
                      } else {
                        console.error('❌ 云端签到记录清除失败');
                      }
                    } catch (e) {
                      console.error('Failed to clear cloud check-ins:', e);
                    }
                  } else {
                    console.warn('⚠️ 没有找到可清除的活动ID');
                  }
                  
                  onClearAll(); // 清除本地数据
                  setShowResetConfirm(false);
                  
                  if (cloudCleared) {
                    showSuccess('已重置所有数据，包括云端签到记录');
                  }
                  
                  onClose();
                }}
                className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-500/20"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
