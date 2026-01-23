import { useEffect, useCallback, ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

// 弹窗类型
export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

// 弹窗配置
export interface ModalConfig {
  type?: ModalType;
  title?: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

// 弹窗 Props
interface ModalProps extends ModalConfig {
  isOpen: boolean;
  onClose: () => void;
}

// 图标配置
const ICONS = {
  info: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  success: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  error: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
  confirm: { icon: AlertCircle, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
};

/**
 * 通用弹窗组件
 * 替代系统的 alert() 和 confirm()
 */
const Modal = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  showCancel = false,
}: ModalProps) => {
  // ESC 键关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      onCancel?.();
    }
  }, [onClose, onCancel]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const iconConfig = ICONS[type];
  const IconComponent = iconConfig.icon;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  // 根据类型决定默认标题
  const displayTitle = title || {
    info: '提示',
    success: '成功',
    warning: '警告',
    error: '错误',
    confirm: '确认',
  }[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
        onClick={handleCancel}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-gradient-to-br from-[#1a1535] to-[#0f0c29] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full animate-scaleIn overflow-hidden">
        {/* 顶部装饰条 */}
        <div className={`h-1 w-full ${
          type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
          type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
          type === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
          type === 'confirm' ? 'bg-gradient-to-r from-orange-500 to-amber-500' :
          'bg-gradient-to-r from-blue-500 to-cyan-500'
        }`} />
        
        {/* 关闭按钮 */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={18} className="text-gray-400" />
        </button>

        <div className="p-6">
          {/* 图标 */}
          <div className={`w-14 h-14 mx-auto mb-4 rounded-full ${iconConfig.bgColor} flex items-center justify-center`}>
            <IconComponent size={28} className={iconConfig.color} />
          </div>
          
          {/* 标题 */}
          <h3 className="text-xl font-bold text-white text-center mb-3">
            {displayTitle}
          </h3>
          
          {/* 消息内容 */}
          <div className="text-gray-300 text-center text-sm leading-relaxed mb-6 whitespace-pre-line">
            {message}
          </div>

          {/* 按钮区域 */}
          <div className={`flex gap-3 ${showCancel || type === 'confirm' ? '' : 'justify-center'}`}>
            {(showCancel || type === 'confirm') && (
              <button
                onClick={handleCancel}
                className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`flex-1 py-3 px-4 font-bold rounded-xl transition-all shadow-lg ${
                type === 'error' 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                  : type === 'success'
                  ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/20'
                  : type === 'warning' || type === 'confirm'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                  : 'bg-gradient-to-r from-[#3c80fa] to-[#573cfa] text-white shadow-blue-500/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* 动画样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
};

export default Modal;
