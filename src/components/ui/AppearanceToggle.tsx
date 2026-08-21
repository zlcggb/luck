import { Moon, Sun } from 'lucide-react';
import { useUiAppearance } from '../../contexts/UiAppearanceContext';

interface AppearanceToggleProps {
  className?: string;
}

const AppearanceToggle = ({ className = '' }: AppearanceToggleProps) => {
  const { appearance, toggleAppearance } = useUiAppearance();
  const isLight = appearance === 'light';

  return (
    <button
      type="button"
      onClick={toggleAppearance}
      aria-label={isLight ? '切换到深色主题' : '切换到浅色主题'}
      title={isLight ? '切换到深色主题' : '切换到浅色主题'}
      className={`vip-icon-button inline-grid h-11 w-11 shrink-0 place-items-center ${className}`}
    >
      {isLight ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  );
};

export default AppearanceToggle;
