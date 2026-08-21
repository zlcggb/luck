import { useEffect, useRef, useState } from 'react';
import { Activity, BadgeCheck, Building2, Clock3, IdCard, ScanLine, Users } from 'lucide-react';
import type { CheckInRecord } from '../../types/checkin';

interface RealtimeFeedProps {
  records: CheckInRecord[];
  maxDisplay?: number;
  autoScroll?: boolean;
  animationStyle?: 'slide' | 'fade' | 'bounce';
}

const formatTime = (isoString: string): string => new Date(isoString).toLocaleTimeString('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const RealtimeFeed = ({ records, maxDisplay = 10, autoScroll = true, animationStyle = 'slide' }: RealtimeFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayRecords, setDisplayRecords] = useState<CheckInRecord[]>([]);

  useEffect(() => setDisplayRecords(records.slice(0, maxDisplay)), [records, maxDisplay]);

  useEffect(() => {
    if (autoScroll && containerRef.current && typeof containerRef.current.scrollTo === 'function') {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [displayRecords, autoScroll]);

  const featuredRecord = displayRecords[0];
  const recentRecords = displayRecords.slice(1);

  return (
    <section className="checkin-feed" aria-label="实时签到舞台">
      <header className="checkin-panel-heading">
        <div className="checkin-panel-title">
          <span className="checkin-live-mark" aria-hidden="true"><Activity size={19} /></span>
          <div><p className="checkin-overline">LIVE ARRIVALS</p><h2>实时签到</h2></div>
        </div>
        <div className="checkin-count-badge"><Users size={15} aria-hidden="true" /><strong className="tabular-nums">{records.length}</strong><span>人已签到</span></div>
      </header>

      <div ref={containerRef} className="checkin-feed-scroll">
        {featuredRecord ? (
          <>
            <article className={`checkin-spotlight checkin-enter-${animationStyle}`}>
              <div className="checkin-spotlight-glow" aria-hidden="true" />
              <div className="checkin-spotlight-copy">
                <div className="checkin-latest-label"><BadgeCheck size={15} aria-hidden="true" />最新签到</div>
                <div className="checkin-featured-person">
                  <div className="checkin-featured-avatar-wrap">
                    <img src={featuredRecord.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${featuredRecord.employeeId}`} alt={featuredRecord.name} className="checkin-featured-avatar" />
                    <span className="checkin-avatar-status" aria-label="签到成功"><BadgeCheck size={16} /></span>
                  </div>
                  <div className="checkin-featured-info">
                    <p className="checkin-welcome-line">欢迎抵达活动现场</p>
                    <h3>{featuredRecord.name}</h3>
                    <div className="checkin-person-meta">
                      <span><Building2 size={15} aria-hidden="true" />{featuredRecord.department || '未分配部门'}</span>
                      <span><IdCard size={15} aria-hidden="true" />{featuredRecord.employeeId}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="checkin-arrival-time">
                <span><Clock3 size={17} aria-hidden="true" />签到时间</span>
                <strong className="tabular-nums">{formatTime(featuredRecord.checkInTime)}</strong>
                <small>{featuredRecord.checkInMethod === 'manual' ? '现场登记' : '扫码签到'}</small>
              </div>
            </article>

            <section className="checkin-sequence" aria-label="签到序列">
              <div className="checkin-sequence-heading">
                <div><p className="checkin-overline">ARRIVAL SEQUENCE</p><h3>签到序列</h3></div>
                <span>按签到时间倒序</span>
              </div>
              {recentRecords.length > 0 ? (
                <div className="checkin-sequence-list">
                  {recentRecords.map((record, index) => (
                    <article key={record.id} className={`checkin-sequence-row checkin-enter-${animationStyle}`} style={{ animationDelay: `${index * 50}ms` }}>
                      <span className="checkin-sequence-index tabular-nums">{String(index + 2).padStart(2, '0')}</span>
                      <img src={record.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.employeeId}`} alt="" className="checkin-sequence-avatar" />
                      <div className="checkin-sequence-person"><strong>{record.name}</strong><span>{record.department || '未分配部门'} · {record.employeeId}</span></div>
                      <time className="tabular-nums" dateTime={record.checkInTime}>{formatTime(record.checkInTime)}</time>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="checkin-next-arrival">
                  <span className="checkin-scan-icon" aria-hidden="true"><ScanLine size={23} /></span>
                  <div><strong>等待下一位嘉宾</strong><p>新签到将实时出现在这里</p></div>
                  <span className="checkin-waiting-dots" aria-hidden="true"><i /><i /><i /></span>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="checkin-empty-stage">
            <span className="checkin-empty-orbit" aria-hidden="true"><ScanLine size={34} /></span>
            <p className="checkin-overline">READY FOR ARRIVALS</p>
            <h3>等待首位嘉宾签到</h3>
            <p>二维码入口已就绪，新的签到记录会实时呈现。</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default RealtimeFeed;
