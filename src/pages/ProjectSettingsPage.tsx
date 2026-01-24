import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Play,
  Eye,
  Loader2,
  Settings
} from 'lucide-react';
import {
  LuckEvent,
  getEvent,
  getPrizes,
  getParticipants,
  createPrize,
  updatePrize as updatePrizeApi,
  deletePrize as deletePrizeApi
} from '../utils/supabaseCheckin';
import { Participant, Prize, DrawRecord } from '../types';
import SettingsPanel from '../components/SettingsPanel';
import { saveParticipants, savePrizes, loadPrizes, saveRecords, loadRecords } from '../utils/storage';

/**
 * 项目设置页面 - 嵌入原有设置面板
 */
const ProjectSettingsPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<LuckEvent | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  
  // 本地状态（用于 SettingsPanel）
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [records, setRecords] = useState<DrawRecord[]>([]);

  // 初始化
  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

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
    saveParticipants([]);
    savePrizes([]);
    saveRecords([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0a1a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0b0a1a] flex flex-col items-center justify-center text-white">
        <p className="text-xl mb-4">项目不存在</p>
        <button onClick={() => navigate('/projects')} className="text-blue-400 hover:underline">
          返回项目列表
        </button>
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-400" />
                {project.name}
              </h1>
              <p className="text-xs text-gray-500">项目管理</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettingsPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              <Settings size={18} />
              <span className="hidden sm:inline">设置</span>
            </button>
            <button
              onClick={() => navigate(`/lottery?event=${projectId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium hover:shadow-lg transition-all"
            >
              <Play size={18} />
              <span className="hidden sm:inline">进入抽奖</span>
            </button>
            <button
              onClick={() => navigate(`/display?event=${projectId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-medium hover:shadow-lg transition-all"
            >
              <Eye size={18} />
              <span className="hidden sm:inline">签到大屏</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 项目信息卡片 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4">项目信息</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">项目名称</p>
                <p className="text-white font-medium">{project.name}</p>
              </div>
              <div>
                <p className="text-gray-500">活动日期</p>
                <p className="text-white font-medium">{new Date(project.event_date).toLocaleDateString('zh-CN')}</p>
              </div>
              <div>
                <p className="text-gray-500">状态</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                  project.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '草稿'}
                </span>
              </div>
            </div>
          </div>

          {/* 参与者统计 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4">参与者</h3>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-400 mb-2">{participants.length}</p>
              <p className="text-gray-500 text-sm">已导入人数</p>
            </div>
          </div>

          {/* 奖项统计 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4">奖项</h3>
            <div className="text-center">
              <p className="text-4xl font-bold text-purple-400 mb-2">{prizes.length}</p>
              <p className="text-gray-500 text-sm">奖项数量</p>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">快速操作</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => setSettingsPanelOpen(true)}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-left"
            >
              <p className="font-medium mb-1">导入名单</p>
              <p className="text-xs text-gray-500">上传 Excel 批量导入</p>
            </button>
            <button
              onClick={() => setSettingsPanelOpen(true)}
              className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-left"
            >
              <p className="font-medium mb-1">配置奖项</p>
              <p className="text-xs text-gray-500">设置奖品和数量</p>
            </button>
            <button
              onClick={() => navigate(`/lottery?event=${projectId}`)}
              className="p-4 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl border border-purple-500/30 transition-all text-left"
            >
              <p className="font-medium mb-1">开始抽奖</p>
              <p className="text-xs text-purple-300">进入抽奖大屏</p>
            </button>
            <button
              onClick={() => navigate(`/display?event=${projectId}`)}
              className="p-4 bg-green-500/20 hover:bg-green-500/30 rounded-xl border border-green-500/30 transition-all text-left"
            >
              <p className="font-medium mb-1">签到管理</p>
              <p className="text-xs text-green-300">打开签到大屏</p>
            </button>
          </div>
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
      />
    </div>
  );
};

export default ProjectSettingsPage;
