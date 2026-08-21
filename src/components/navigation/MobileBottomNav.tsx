import { CircleUserRound, FolderKanban, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolveLotteryDestination } from '../../utils/mobileNavigation';

export type MobileNavSection = 'projects' | 'lottery' | 'profile';

interface MobileBottomNavProps {
  active: MobileNavSection;
  lotteryProjectId?: string | null;
}

const MobileBottomNav = ({ active, lotteryProjectId }: MobileBottomNavProps) => {
  const items = [
    { id: 'projects' as const, label: '项目', to: '/projects', Icon: FolderKanban },
    { id: 'lottery' as const, label: '抽奖', to: resolveLotteryDestination(lotteryProjectId), Icon: Sparkles },
    { id: 'profile' as const, label: '我的', to: '/profile', Icon: CircleUserRound },
  ];

  return (
    <nav
      aria-label="手机端主导航"
      className="vip-mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 sm:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 px-3 pt-2">
        {items.map(({ id, label, to, Icon }) => {
          const isActive = active === id;
          return (
            <Link
              key={id}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={`mx-auto flex min-h-11 min-w-20 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-[var(--ui-primary-soft,#eff6ff)] text-[var(--ui-primary,#2563eb)]'
                  : 'text-[var(--ui-text-muted,#6b7280)] active:bg-[var(--ui-surface-soft,#f3f4f6)]'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.9} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
