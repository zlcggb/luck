import { useState, useCallback } from 'react';
import Modal, { ModalConfig } from '../components/Modal';

interface UseModalReturn {
  // 弹窗组件
  ModalComponent: JSX.Element;
  // 显示各种类型的弹窗
  showModal: (config: ModalConfig) => void;
  showInfo: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  // 确认弹窗，返回 Promise
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  // 关闭弹窗
  closeModal: () => void;
}

/**
 * 弹窗 Hook
 * 提供便捷的方法来显示各种类型的弹窗
 */
export const useModal = (): UseModalReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ModalConfig>({ message: '' });
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

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
      setResolvePromise(() => resolve);
      showModal({
        type: 'confirm',
        message,
        title,
        showCancel: true,
        onConfirm: () => {
          resolve(true);
          setResolvePromise(null);
        },
        onCancel: () => {
          resolve(false);
          setResolvePromise(null);
        },
      });
    });
  }, [showModal]);

  const handleConfirm = useCallback(() => {
    config.onConfirm?.();
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
    }
  }, [config, resolvePromise]);

  const handleCancel = useCallback(() => {
    config.onCancel?.();
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [config, resolvePromise]);

  const ModalComponent = (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      {...config}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return {
    ModalComponent,
    showModal,
    showInfo,
    showSuccess,
    showWarning,
    showError,
    showConfirm,
    closeModal,
  };
};

export default useModal;
