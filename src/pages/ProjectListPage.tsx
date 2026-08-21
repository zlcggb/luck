import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Calendar,
  Users,
  Gift,
  ChevronRight,
  Search,
  Loader2,
  Sparkles,
  Settings,
  LogOut,
  MoreVertical,
  Trash2,
  Copy,
  ScanLine,
  Dices
} from 'lucide-react';
import {
  supabase,
  LuckUser,
  LuckEvent,
  getOrCreateUser,
  getUserProjects,
  createProject,
  deleteProject,
  getProjectStats
} from '../utils/supabaseCheckin';
import MobileBottomNav from '../components/navigation/MobileBottomNav';
import AppearanceToggle from '../components/ui/AppearanceToggle';
import { useUiAppearance } from '../contexts/UiAppearanceContext';
import {
  clearLastProject,
  getLastProjectId,
  rememberLastProject,
  selectLotteryProjectId,
} from '../utils/mobileNavigation';

// 项目卡片统计
interface ProjectWithStats extends LuckEvent {
  stats?: {
    participantCount: number;
    checkedInCount: number;
    prizeCount: number;
    winnerCount: number;
  };
}

/**
 * 项目列表页面
 */
const ProjectListPage = () => {
  const navigate = useNavigate();
  const { appearance } = useUiAppearance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<LuckUser | null>(null);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectMode, setNewProjectMode] = useState<'wheel' | 'rolling'>('wheel');
  const [creating, setCreating] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [lotteryProjectId, setLotteryProjectId] = useState<string | null>(getLastProjectId());

  // 初始化
  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    const requestedMode = searchParams.get('create');
    if (requestedMode !== 'wheel' && requestedMode !== 'rolling') return;

    setNewProjectMode(requestedMode);
    setShowCreateModal(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // 初始化用户
  const initUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      // 未登录，重定向到登录页
      navigate('/login');
      return;
    }

    const luckUser = await getOrCreateUser({
      id: authUser.id,
      email: authUser.email!,
      name: authUser.user_metadata?.name
    });

    if (luckUser) {
      setUser(luckUser);
      await loadProjects(luckUser.id);
    }
    setLoading(false);
  };

  // 加载项目列表
  const loadProjects = async (userId: string) => {
    const projectList = await getUserProjects(userId);
    
    // 加载每个项目的统计数据
    const projectsWithStats = await Promise.all(
      projectList.map(async (project) => {
        const stats = await getProjectStats(project.id);
        return { ...project, stats };
      })
    );

    setProjects(projectsWithStats);
    const nextLotteryProjectId = selectLotteryProjectId(projectsWithStats.map(project => project.id));
    setLotteryProjectId(nextLotteryProjectId);
    if (nextLotteryProjectId) rememberLastProject(nextLotteryProjectId);
    else clearLastProject();
  };

  const openProject = (projectId: string) => {
    rememberLastProject(projectId);
    setLotteryProjectId(projectId);
    navigate(`/project/${projectId}`);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    
    setCreating(true);
    const project = await createProject(user.id, { name: newProjectName.trim(), mode: newProjectMode });
    
    if (project) {
      setProjects([{ ...project, stats: { participantCount: 0, checkedInCount: 0, prizeCount: 0, winnerCount: 0 } }, ...projects]);
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectMode('wheel');
      openProject(project.id);
    }
    setCreating(false);
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('确定要删除此项目吗？此操作不可恢复。')) return;
    
    const success = await deleteProject(projectId);
    if (success) {
      const remainingProjects = projects.filter(p => p.id !== projectId);
      setProjects(remainingProjects);
      clearLastProject(projectId);
      const nextLotteryProjectId = selectLotteryProjectId(remainingProjects.map(project => project.id));
      setLotteryProjectId(nextLotteryProjectId);
      if (nextLotteryProjectId) rememberLastProject(nextLotteryProjectId);
    }
    setActiveMenu(null);
  };

  // 登出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // 过滤项目
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // 状态标签
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    const labels = {
      draft: '草稿',
      active: '进行中',
      completed: '已完成'
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="vip-ui admin-ui flex min-h-screen items-center justify-center" data-ui-theme={appearance}>
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="vip-ui admin-ui min-h-screen" data-ui-theme={appearance}>
      {/* Header */}
      <header className="vip-glass sticky top-0 z-30 border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3b82f6] shadow-[0_8px_20px_rgba(59,130,246,.22)]">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">抽奖签到系统</h1>
              <p className="text-xs text-gray-500">管理您的抽奖项目</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <AppearanceToggle className="hidden sm:inline-grid" />
            {user && (
              <button type="button" onClick={() => navigate('/profile')} className="flex items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6] font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </button>
            )}
            <button
              onClick={handleLogout}
              aria-label="退出登录"
              className="vip-icon-button grid w-11 place-items-center transition-colors"
              title="退出登录"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative z-10 mx-auto max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:pb-16">
        {/* 工具栏 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-medium text-[#2563eb]">活动管理</p>
            <h2 className="mt-1 text-2xl font-semibold">我的项目</h2>
            <p className="mt-1 text-sm text-gray-500">共 {projects.length} 个项目</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* 搜索框 */}
            <div className="relative flex-1 sm:w-64">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目..."
                className="vip-input w-full pl-11 pr-4 py-3 text-[15px] font-medium"
              />
            </div>
            
            {/* 创建按钮 */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="vip-button-primary flex items-center gap-2 px-5 py-3 font-bold whitespace-nowrap"
            >
              <Plus size={20} />
              <span className="hidden sm:inline tracking-wide">新建项目</span>
            </button>
          </div>
        </div>

        {/* 项目列表 */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FolderOpen size={64} className="text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg mb-2">
              {searchQuery ? '没有找到匹配的项目' : '还没有创建任何项目'}
            </p>
            <p className="text-gray-600 text-sm mb-6">
              {searchQuery ? '尝试其他搜索词' : '点击上方按钮创建新项目'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="vip-button-primary flex items-center gap-2 px-6 py-3 font-medium"
              >
                <Plus size={20} />
                创建第一个项目
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="vip-card vip-card-interactive group relative overflow-hidden rounded-[24px]"
              >
                {/* 封面 */}
                <div 
                  className="relative h-28 cursor-pointer border-b border-[#e5e7eb] bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_62%,#eef2ff_100%)]"
                  onClick={() => openProject(project.id)}
                >
                  {project.cover_image ? (
                     <img src={project.cover_image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white bg-white/80 text-[#3b82f6] shadow-sm"><Sparkles size={24} /></span>
                    </div>
                  )}
                  
                  {/* 状态标签 */}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <StatusBadge status={project.status} />
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-xl border ${
                      (project as any).mode === 'rolling'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {(project as any).mode === 'rolling' ? '轮动式' : '转盘式'}
                    </span>
                  </div>
                  
                  {/* 更多菜单 */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === project.id ? null : project.id);
                      }}
                      aria-label={`打开 ${project.name} 项目菜单`}
                      className="w-8 h-8 apple-glass backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center text-white/80 transition-colors border border-white/10"
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {activeMenu === project.id && (
                      <div className="absolute right-0 top-10 w-44 apple-glass border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 py-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProject(project.id);
                          }}
                          className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-white/10 flex items-center gap-3 transition-colors"
                        >
                          <Settings size={16} className="text-white/60" />
                          项目设置
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(project.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-white/10 flex items-center gap-3 transition-colors"
                        >
                          <Copy size={16} className="text-white/60" />
                          复制ID
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-red-500/20 text-red-400 flex items-center gap-3 transition-colors mt-1 border-t border-white/5 pt-3"
                        >
                          <Trash2 size={16} />
                          删除项目
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 内容 */}
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => openProject(project.id)}
                >
                  <h3 className="mb-1.5 truncate text-lg font-semibold tracking-tight">{project.name}</h3>
                  <p className="mb-5 flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280]">
                    <Calendar size={14} />
                    {formatDate(project.event_date)}
                  </p>
                  
                  {/* 统计 */}
                  <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f9fafb]">
                    <div className="border-r border-[#e5e7eb] p-3 text-center">
                      <Users size={16} className="mx-auto mb-1.5 text-blue-400" />
                      <p className="text-[17px] font-bold">{project.stats?.participantCount || 0}</p>
                      <p className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-0.5">登记</p>
                    </div>
                    <div className="border-r border-[#e5e7eb] p-3 text-center">
                      <Gift size={16} className="mx-auto mb-1.5 text-purple-400" />
                      <p className="text-[17px] font-bold">{project.stats?.prizeCount || 0}</p>
                      <p className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-0.5">奖项</p>
                    </div>
                    <div className="p-3 text-center">
                      <Sparkles size={16} className="mx-auto mb-1.5 text-amber-400" />
                      <p className="text-[17px] font-bold">{project.stats?.winnerCount || 0}</p>
                      <p className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-0.5">中奖</p>
                    </div>
                  </div>
                </div>
                
                {/* 进入按钮 */}
                <div className="px-6 pb-6">
                  <button
                    onClick={() => openProject(project.id)}
                    className="vip-button-secondary w-full py-3 text-[14px] font-bold tracking-wider uppercase flex items-center justify-center gap-2"
                  >
                    打开项目
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 创建项目弹窗 */}
      {showCreateModal && (
        <div className="vip-modal-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-4">
        <div className="vip-modal p-8 w-full max-w-sm transform animate-bounceIn">
            <h3 className="text-2xl font-bold tracking-tight mb-2">新建项目</h3>
            <p className="text-[13px] text-white/50 tracking-wide mb-6">输入展会或活动名称并选择抽奖模式</p>
            
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. 2026 Apple Event"
              className="vip-input w-full px-4 py-3.5 text-[15px] font-medium mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />

            {/* 模式选择器 */}
            <div className="mb-6">
              <p className="text-[12px] text-white/40 font-semibold uppercase tracking-wider mb-3">抽奖模式</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewProjectMode('wheel')}
                  className={`py-3 rounded-2xl text-[13px] font-bold tracking-wide border transition-all ${
                    newProjectMode === 'wheel'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-2"><ScanLine size={16} />转盘式</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewProjectMode('rolling')}
                  className={`py-3 rounded-2xl text-[13px] font-bold tracking-wide border transition-all ${
                    newProjectMode === 'rolling'
                      ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-[0_0_20px_rgba(59,130,246,0.12)]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-2"><Dices size={16} />轮动式</span>
                </button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                  setNewProjectMode('wheel');
                }}
                className="vip-button-secondary flex-1 py-3.5 font-semibold"
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || creating}
                className="vip-button-primary flex-1 py-3.5 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={18} className="animate-spin text-black" /> : <Plus size={18} />}
                创建并进入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 点击外部关闭菜单 */}
      {activeMenu && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setActiveMenu(null)}
        />
      )}
      <MobileBottomNav active="projects" lotteryProjectId={lotteryProjectId} />
    </div>
  );
};

export default ProjectListPage;
