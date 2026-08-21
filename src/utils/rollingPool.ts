import type { Participant } from '../types';
import type { LuckParticipant } from './supabaseCheckin';

const toPoolParticipant = (participant: LuckParticipant): Participant => {
  const employeeId = participant.employee_id.trim().toUpperCase();
  return {
    id: employeeId,
    name: participant.name.trim(),
    dept: participant.department || '',
    avatar: participant.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(employeeId)}`,
  };
};

export const buildRollingPool = (
  participants: LuckParticipant[],
  excludedIds: ReadonlySet<string>,
): Participant[] => participants
  .filter((participant) => participant.status === 'checked_in')
  .map(toPoolParticipant)
  .filter((participant) => !excludedIds.has(participant.id));

export const mergeCheckedInParticipant = (
  current: Participant[],
  participant: LuckParticipant,
): Participant[] => {
  if (participant.status !== 'checked_in') return current;

  const nextParticipant = toPoolParticipant(participant);
  const existingIndex = current.findIndex((item) => item.id === nextParticipant.id);
  if (existingIndex < 0) return [...current, nextParticipant];

  return current.map((item, index) => (
    index === existingIndex ? nextParticipant : item
  ));
};
