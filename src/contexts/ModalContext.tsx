import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Modal, { ModalConfig } from '../components/Modal';

// Context 类型
interface ModalContextType {
  showInfo: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  closeModal: () => void;
}

// 创建 Context
const ModalContext = createContext<ModalContextType | null>(null);

// Provider Props
interface ModalProviderProps {
  children: ReactNode;
}

/**
 * 弹窗 Provider
 * 包裹在应用最外层，提供全局弹窗能力
 */
export const ModalProvider = ({ children }: ModalProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ModalConfig>({ message: '' });
  const [resolveRef, setResolveRef] = useState<{ resolve: (value: boolean) => void } | null>(null);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showModal = useCallback((newConfig: ModalConfig) => {
    setConfig(newConfig);
    setIsOpen(true);
  }, []);

  const showInfo = useCallback((message: string, title?: string) => {
    showModal({ type: 'info', message, title });
  }, [showModal]);

  const showSuccess = useCallback((message: string, title?: string) => {
    showModal({ type: 'success', message, title });
  }, [showModal]);

  const showWarning = useCallback((message: string, title?: string) => {
    showModal({ type: 'warning', message, title });
  }, [showModal]);

  const showError = useCallback((message: string, title?: string) => {
    showModal({ type: 'error', message, title });
  }, [showModal]);

  const showConfirm = useCallback((message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveRef({ resolve });
      showModal({
        type: 'confirm',
        message,
        title,
        showCancel: true,
      });
    });
  }, [showModal]);

  const handleConfirm = useCallback(() => {
    config.onConfirm?.();
    setIsOpen(false);
    if (resolveRef) {
      resolveRef.resolve(true);
      setResolveRef(null);
    }
  }, [config, resolveRef]);

  const handleCancel = useCallback(() => {
    config.onCancel?.();
    setIsOpen(false);
    if (resolveRef) {
      resolveRef.resolve(false);
      setResolveRef(null);
    }
  }, [config, resolveRef]);

  return (
    <ModalContext.Provider value={{ showInfo, showSuccess, showWarning, showError, showConfirm, closeModal }}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        {...config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ModalContext.Provider>
  );
};

/**
 * 使用弹窗的 Hook
 */
export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export default ModalProvider;
