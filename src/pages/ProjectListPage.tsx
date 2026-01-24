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

  // 创建项目
  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    
    setCreating(true);
    const project = await createProject(user.id, { name: newProjectName.trim() });
    
    if (project) {
      setProjects([{ ...project, stats: { participantCount: 0, checkedInCount: 0, prizeCount: 0, winnerCount: 0 } }, ...projects]);
      setShowCreateModal(false);
      setNewProjectName('');
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
      {/* 背景 */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/20 filter blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-600/15 filter blur-[150px]" />
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
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            {/* 创建按钮 */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all whitespace-nowrap"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">新建项目</span>
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
                className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10"
              >
                {/* 封面 */}
                <div 
                  className="h-32 bg-gradient-to-br from-blue-600/30 to-purple-600/30 relative cursor-pointer"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  {project.cover_image ? (
                    <img src={project.cover_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles size={48} className="text-white/30" />
                    </div>
                  )}
                  
                  {/* 状态标签 */}
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={project.status} />
                  </div>
                  
                  {/* 更多菜单 */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === project.id ? null : project.id);
                      }}
                      className="w-8 h-8 bg-black/50 hover:bg-black/70 rounded-lg flex items-center justify-center text-white transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {activeMenu === project.id && (
                      <div className="absolute right-0 top-10 w-40 bg-[#1c1c1e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/project/${project.id}`);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                        >
                          <Settings size={16} />
                          项目设置
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(project.id);
                            setActiveMenu(null);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                        >
                          <Copy size={16} />
                          复制ID
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-red-500/20 text-red-400 flex items-center gap-2"
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
                  className="p-4 cursor-pointer"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <h3 className="text-lg font-bold mb-1 truncate">{project.name}</h3>
                  <p className="text-gray-500 text-sm mb-4 flex items-center gap-1">
                    <Calendar size={14} />
                    {formatDate(project.event_date)}
                  </p>
                  
                  {/* 统计 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <Users size={16} className="mx-auto mb-1 text-blue-400" />
                      <p className="text-lg font-bold">{project.stats?.participantCount || 0}</p>
                      <p className="text-xs text-gray-500">参与者</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <Gift size={16} className="mx-auto mb-1 text-purple-400" />
                      <p className="text-lg font-bold">{project.stats?.prizeCount || 0}</p>
                      <p className="text-xs text-gray-500">奖项</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <Sparkles size={16} className="mx-auto mb-1 text-yellow-400" />
                      <p className="text-lg font-bold">{project.stats?.winnerCount || 0}</p>
                      <p className="text-xs text-gray-500">中奖</p>
                    </div>
                  </div>
                </div>
                
                {/* 进入按钮 */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    进入项目
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">创建新项目</h3>
            
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="项目名称，如：2024年会抽奖"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || creating}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                创建
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
