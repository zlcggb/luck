import type { CSSProperties } from 'react';
import { Building2, Clock3, TrendingUp, UserCheck, Users } from 'lucide-react';

interface DepartmentStat {
  department: string;
  total: number;
  checkedIn: number;
  percentage: number;
}

interface CheckInStatsProps {
  totalParticipants: number;
  checkedInCount: number;
  checkInPercentage: number;
  lastCheckInTime?: string;
  departmentStats?: DepartmentStat[];
  showDepartmentStats?: boolean;
  variant?: 'default' | 'compact' | 'large';
}

const formatTime = (isoString: string): string => new Date(isoString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

const CheckInStats = ({ totalParticipants, checkedInCount, checkInPercentage, lastCheckInTime, departmentStats = [], showDepartmentStats = true, variant = 'default' }: CheckInStatsProps) => {
  const total = Math.max(totalParticipants, 0);
  const checked = Math.min(Math.max(checkedInCount, 0), total || checkedInCount);
  const pending = Math.max(total - checked, 0);
  const progress = Math.min(Math.max(checkInPercentage, 0), 100);

  if (variant === 'compact') {
    return <div className="checkin-stats-compact"><UserCheck size={16} /><strong className="tabular-nums">{checked}</strong><span>/ {total}</span><div className="checkin-progress-track"><i style={{ width: `${progress}%` }} /></div><b>{progress}%</b></div>;
  }

  if (variant !== 'large') {
    return <div className="checkin-stats-default"><span><UserCheck size={16} />已签到 <strong>{checked}</strong></span><span><Users size={16} />总人数 <strong>{total}</strong></span><span><TrendingUp size={16} />签到率 <strong>{progress}%</strong></span></div>;
  }

  return (
    <section className="checkin-progress-panel" aria-labelledby="checkin-progress-title">
      <header className="checkin-panel-heading">
        <div className="checkin-panel-title">
          <span className="checkin-stat-mark" aria-hidden="true"><TrendingUp size={19} /></span>
          <div><p className="checkin-overline">ATTENDANCE</p><h2 id="checkin-progress-title">签到进度</h2></div>
        </div>
        <span className="checkin-live-chip"><i />实时</span>
      </header>

      <div className="checkin-progress-hero">
        <div className="checkin-progress-ring" role="img" aria-label={`签到率 ${progress}%`} style={{ '--checkin-progress': `${progress}%` } as CSSProperties}>
          <div className="checkin-progress-ring-inner"><div><strong className="tabular-nums">{progress}</strong><span>%</span></div><small>签到率</small></div>
        </div>
        <div className="checkin-progress-copy">
          <p>现场签到完成度</p>
          <strong><span className="tabular-nums">{checked}</span><small> / {total}</small></strong>
          <div className="checkin-progress-track"><i style={{ width: `${progress}%` }} /></div>
          <span>{pending > 0 ? `还有 ${pending} 人未签到` : '全员签到完成'}</span>
        </div>
      </div>

      <div className="checkin-metric-grid">
        <div className="checkin-metric-card"><span className="checkin-metric-icon is-primary"><UserCheck size={17} /></span><div><small>已签到</small><strong className="tabular-nums">{checked}</strong></div></div>
        <div className="checkin-metric-card"><span className="checkin-metric-icon"><Users size={17} /></span><div><small>待签到</small><strong className="tabular-nums">{pending}</strong></div></div>
        <div className="checkin-metric-card is-wide"><span className="checkin-metric-icon"><Clock3 size={17} /></span><div><small>最后签到</small><strong className="tabular-nums">{lastCheckInTime ? formatTime(lastCheckInTime) : '--:--'}</strong></div></div>
      </div>

      {showDepartmentStats && departmentStats.length > 0 && (
        <section className="checkin-department-block" aria-labelledby="department-title">
          <div className="checkin-department-heading"><div><Building2 size={17} /><h3 id="department-title">部门分布</h3></div><span>{departmentStats.length} 个部门</span></div>
          <div className="checkin-department-list">
            {departmentStats.slice(0, 6).map((department, index) => (
              <div className="checkin-department-row" key={department.department}>
                <div className="checkin-department-meta"><span>{department.department}</span><strong className="tabular-nums">{department.checkedIn} / {department.total}</strong></div>
                <div className="checkin-department-track"><i style={{ width: `${Math.min(Math.max(department.percentage, 0), 100)}%`, transitionDelay: `${index * 50}ms` }} /></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
};

export default CheckInStats;
