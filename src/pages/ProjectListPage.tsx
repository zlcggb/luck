import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Copy
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
  const [user, setUser] = useState<LuckUser | null>(null);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectMode, setNewProjectMode] = useState<'wheel' | 'rolling'>('wheel');
  const [creating, setCreating] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // 初始化
  useEffect(() => {
    initUser();
  }, []);

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
      // 跳转到项目设置页
      navigate(`/project/${project.id}`);
    }
    setCreating(false);
  };

  // 删除项目
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('确定要删除此项目吗？此操作不可恢复。')) return;
    
    const success = await deleteProject(projectId);
    if (success) {
      setProjects(projects.filter(p => p.id !== projectId));
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
      <div className="min-h-screen bg-[#0b0a1a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0a1a] text-white">
      {/* 沉浸式流光背景 */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[50vw] h-[50vw] bg-blue-600/20 mix-blend-screen filter blur-[150px] rounded-full" />
        <div className="absolute bottom-[10%] right-[10%] w-[60vw] h-[60vw] bg-purple-600/15 mix-blend-screen filter blur-[150px] rounded-full" />
        <div className="absolute inset-0 bg-black/40 apple-gradient-mask" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">抽奖签到系统</h1>
              <p className="text-xs text-gray-500">管理您的抽奖项目</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="退出登录"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* 工具栏 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold">我的项目</h2>
            <p className="text-gray-500 text-sm mt-1">{projects.length} 个项目</p>
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
                className="w-full pl-11 pr-4 py-3 apple-glass border border-white/10 rounded-2xl text-[15px] font-medium text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]"
              />
            </div>
            
            {/* 创建按钮 */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-2xl font-bold hover:shadow-[0_4px_30px_rgba(255,255,255,0.4)] transition-all active:scale-95 whitespace-nowrap"
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
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium transition-colors"
              >
                <Plus size={20} />
                创建第一个项目
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="group relative apple-glass border border-white/10 rounded-[28px] overflow-hidden hover:border-white/20 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform hover:-translate-y-1"
              >
                {/* 封面 */}
                <div 
                  className="h-36 bg-gradient-to-br from-[#0a0a0c] to-[#1c1c1e] relative cursor-pointer border-b border-white/5"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  {project.cover_image ? (
                     <img src={project.cover_image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors">
                      <Sparkles size={40} className="text-white/20 group-hover:text-white/40 transition-colors" />
                    </div>
                  )}
                  
                  {/* 状态标签 */}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <StatusBadge status={project.status} />
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-xl border ${
                      (project as any).mode === 'rolling'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
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
                      className="w-8 h-8 apple-glass backdrop-blur-xl hover:bg-white/20 rounded-full flex items-center justify-center text-white/80 transition-colors border border-white/10"
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {activeMenu === project.id && (
                      <div className="absolute right-0 top-10 w-44 apple-glass border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 py-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/project/${project.id}`);
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
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <h3 className="text-xl font-bold tracking-tight mb-1.5 truncate">{project.name}</h3>
                  <p className="text-white/50 text-[13px] font-medium tracking-wide mb-6 flex items-center gap-1.5 uppercase">
                    <Calendar size={14} />
                    {formatDate(project.event_date)}
                  </p>
                  
                  {/* 统计 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="apple-glass rounded-xl p-3 text-center border border-white/5">
                      <Users size={16} className="mx-auto mb-1.5 text-blue-400" />
                      <p className="text-[17px] font-bold">{project.stats?.participantCount || 0}</p>
                      <p className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-0.5">登记</p>
                    </div>
                    <div className="apple-glass rounded-xl p-3 text-center border border-white/5">
                      <Gift size={16} className="mx-auto mb-1.5 text-purple-400" />
                      <p className="text-[17px] font-bold">{project.stats?.prizeCount || 0}</p>
                      <p className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-0.5">奖项</p>
                    </div>
                    <div className="apple-glass rounded-xl p-3 text-center border border-white/5">
                      <Sparkles size={16} className="mx-auto mb-1.5 text-amber-400" />
                      <p className="text-[17px] font-bold">{project.stats?.winnerCount || 0}</p>
                      <p className="text-[10px] font-semibold tracking-wider text-white/40 uppercase mt-0.5">中奖</p>
                    </div>
                  </div>
                </div>
                
                {/* 进入按钮 */}
                <div className="px-6 pb-6">
                  <button
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="w-full py-3 apple-glass hover:bg-white/10 rounded-2xl text-[14px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/10"
                  >
                    ENTER WORKSPACE
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
        <div className="apple-glass-dark border border-white/15 rounded-[32px] p-8 w-full max-w-sm shadow-[0_20px_80px_rgba(0,0,0,0.6)] transform animate-bounceIn">
            <h3 className="text-2xl font-bold tracking-tight mb-2">新建项目</h3>
            <p className="text-[13px] text-white/50 tracking-wide mb-6">输入展会或活动名称并选择抽奖模式</p>
            
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. 2026 Apple Event"
              className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-2xl text-[15px] font-medium text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 mb-4 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]"
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
                  🎰 转盘式
                </button>
                <button
                  type="button"
                  onClick={() => setNewProjectMode('rolling')}
                  className={`py-3 rounded-2xl text-[13px] font-bold tracking-wide border transition-all ${
                    newProjectMode === 'rolling'
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  🎲 轮动式
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
                className="flex-1 py-3.5 apple-glass hover:bg-white/10 rounded-2xl font-semibold transition-all text-white/80"
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || creating}
                className="flex-1 py-3.5 bg-white text-black hover:bg-gray-100 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-all"
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
    </div>
  );
};

export default ProjectListPage;
