import { useState, useRef } from 'react';
import { 
  X, Upload, Download, FileSpreadsheet, Award, History, 
  Trash2, Plus, Minus, RotateCcw, AlertCircle
} from 'lucide-react';
import { Participant, Prize, DrawRecord } from '../types';
import { exportWinnersToExcel, downloadTemplate, parseExcelFile, processImportData } from '../utils/excel';

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
}

type TabType = 'import' | 'prizes' | 'history' | 'export';

const SettingsPanel = ({
  isOpen,
  onClose,
  participants,
  onParticipantsChange,
  prizes,
  onPrizesChange,
  records,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRecordsChange: _onRecordsChange,
  onUndoRecord,
  onClearAll,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 用于导入预览的状态
  const [previewFile, setPreviewFile] = useState<{ headers: string[], data: any[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState({ id: '', name: '', dept: '' });

  // 处理文件选择（第一步：解析预览）
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const { headers, data } = await parseExcelFile(file);
      
      if (headers.length === 0 || data.length === 0) {
        alert('文件内容为空或格式不正确');
        return;
      }

      setPreviewFile({ headers, data });
      
      // 尝试自动匹配
      const autoMapping = {
        id: headers.find(h => ['工号', 'ID', 'id', 'EmployeeID', '工号/ID'].includes(h)) || headers[0] || '',
        name: headers.find(h => ['姓名', 'Name', 'name', '员工姓名'].includes(h)) || headers[1] || '',
        dept: headers.find(h => ['部门', '组织', 'Dept', 'Department', '部门/组织'].includes(h)) || '',
      };
      setColumnMapping(autoMapping);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '无法解析 Excel 文件';
      alert(errorMessage);
      console.error('[Excel Import Error]', error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 确认导入（第二步：处理数据）
  const confirmImport = () => {
    if (!previewFile) return;
    if (!columnMapping.name) {
      alert('请至少选择"姓名"对应的列');
      return;
    }

    // 直接调用处理函数
    const imported = processImportData(previewFile.data, columnMapping);
    if (imported.length === 0) {
      alert('未能提取到有效数据，请检查映射关系');
      return;
    }
    onParticipantsChange(imported);
    alert(`成功导入 ${imported.length} 名参与者！`);
    setPreviewFile(null);
  };

  const cancelPreview = () => {
    setPreviewFile(null);
    setColumnMapping({ id: '', name: '', dept: '' });
  };

  // 添加奖项
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

  // 更新奖项
  const updatePrize = (id: string, field: keyof Prize, value: string | number) => {
    onPrizesChange(
      prizes.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  // 删除奖项
  const deletePrize = (id: string) => {
    if (prizes.length <= 1) {
      alert('至少保留一个奖项');
      return;
    }
    onPrizesChange(prizes.filter(p => p.id !== id));
  };

  // Tab 配置
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'import', label: '导入名单', icon: <Upload size={18} /> },
    { id: 'prizes', label: '奖项设置', icon: <Award size={18} /> },
    { id: 'history', label: '历史记录', icon: <History size={18} /> },
    { id: 'export', label: '数据导出', icon: <Download size={18} /> },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 面板 */}
      <div className="relative ml-auto w-full max-w-md h-full bg-[#0f0c29]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">设置</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

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
                // 状态 A: 初始选择文件界面
                <>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <FileSpreadsheet size={20} className="text-[#3c80fa]" />
                      <span className="font-medium text-white">当前名单</span>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">{participants.length} <span className="text-sm font-normal text-gray-400">人</span></p>
                    <p className="text-xs text-gray-500">支持 .xlsx, .xls 格式</p>
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
                // 状态 B: 预览与映射界面
                <div className="animate-fade-in space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold">导入设置</h3>
                    <button onClick={cancelPreview} className="text-xs text-gray-400 hover:text-white">取消</button>
                  </div>

                  {/* 映射选择器 */}
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

                    <div className="grid grid-cols-2 gap-3">
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
                    </div>
                  </div>

                  {/* 数据预览表格 */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">前 5 行数据预览：</p>
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-left text-xs text-gray-400">
                        <thead className="bg-white/10 text-white font-bold">
                          <tr>
                            {previewFile.headers.map(h => (
                               <th key={h} className={`p-2 whitespace-nowrap ${[columnMapping.name, columnMapping.id, columnMapping.dept].includes(h) ? 'text-[#3c80fa]' : ''}`}>
                                 {h}
                                 {h === columnMapping.name && ' (姓名)'}
                                 {h === columnMapping.id && ' (工号)'}
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

                  {/* 底部按钮 */}
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
                      {/* Name Input */}
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
                      
                      {/* Description Input */}
                      <input
                        type="text"
                        value={prize.description || ''}
                        onChange={(e) => updatePrize(prize.id, 'description', e.target.value)}
                        className="w-full bg-transparent text-sm text-gray-300 border-b border-white/10 focus:border-[#3c80fa] outline-none py-1 placeholder-gray-600 ml-8"
                        placeholder="奖品描述 (如: Macbook Pro)"
                      />

                      {/* Image Upload */}
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
                            src={winner.avatar} 
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

          {/* 数据导出 */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Award size={20} className="text-[#b63cfa]" />
                  <span className="font-medium text-white">中奖统计</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {records.reduce((sum, r) => sum + r.winners.length, 0)}
                    </p>
                    <p className="text-xs text-gray-500">中奖人数</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{records.length}</p>
                    <p className="text-xs text-gray-500">抽奖轮次</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => exportWinnersToExcel(records)}
                disabled={records.length === 0}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={18} />
                导出中奖名单 (Excel)
              </button>

              <div className="border-t border-white/10 pt-4 mt-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">危险操作</h3>
                <button
                  onClick={() => {
                    if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
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
    </div>
  );
};

export default SettingsPanel;
