'use client';

import { getTabGroupClass } from '@/lib/role-theme';

interface ExamFilterTabsProps {
  role?: string;
  showExpired: boolean;
  onShowActive: () => void;
  onShowExpired: () => void;
}

export default function ExamFilterTabs({
  role,
  showExpired,
  onShowActive,
  onShowExpired,
}: ExamFilterTabsProps) {
  return (
    <div className={`tab-group ${getTabGroupClass(role)}`}>
      <button
        type="button"
        onClick={onShowActive}
        className={`tab-btn${!showExpired ? ' tab-btn-active' : ''}`}
      >
        Active
      </button>
      <button
        type="button"
        onClick={onShowExpired}
        className={`tab-btn${showExpired ? ' tab-btn-active' : ''}`}
      >
        Expired
      </button>
    </div>
  );
}
