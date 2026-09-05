export function formatAmount(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateStr));
}

export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'bg-gray-100 text-gray-700',
    ANALYZING: 'bg-blue-100 text-blue-700',
    ACTION_PENDING: 'bg-amber-100 text-amber-700',
    ACTIONED: 'bg-purple-100 text-purple-700',
    RECOVERED: 'bg-green-100 text-green-700',
    ESCALATED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-slate-100 text-slate-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}
