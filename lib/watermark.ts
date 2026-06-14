export interface WatermarkMeta {
  examTitle: string;
  subject: string;
  examId: string;
  centerLabel: string;
  releasedBy: string;
  releasedByRole: string;
  releasedAt: string;
  traceId: string;
}

export function buildTraceId(examId: string, releasedAt?: string): string {
  const timePart = releasedAt
    ? new Date(releasedAt).getTime().toString(36).slice(-4).toUpperCase()
    : Date.now().toString(36).slice(-4).toUpperCase();
  return `${examId.replace(/-/g, '').slice(0, 8).toUpperCase()}-${timePart}`;
}

export function formatCenterLabel(centerId?: string): string {
  if (!centerId) return 'Exam Center';
  return centerId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function buildWatermarkMeta(input: {
  examId: string;
  examTitle: string;
  subject: string;
  centerId?: string;
  releasedBy: string;
  releasedByRole: string;
  releasedAt?: string;
}): WatermarkMeta {
  const releasedAt = input.releasedAt ?? new Date().toISOString();
  return {
    examId: input.examId,
    examTitle: input.examTitle,
    subject: input.subject,
    centerLabel: formatCenterLabel(input.centerId),
    releasedBy: input.releasedBy,
    releasedByRole: input.releasedByRole,
    releasedAt,
    traceId: buildTraceId(input.examId, releasedAt),
  };
}

export function watermarkBannerText(meta: WatermarkMeta): string {
  const when = new Date(meta.releasedAt).toLocaleString('en-IN');
  return `OFFICIAL · ${meta.centerLabel} · Released by ${meta.releasedBy} (${meta.releasedByRole}) · ${when} · Trace ${meta.traceId}`;
}

export function watermarkRepeatText(meta: WatermarkMeta): string {
  return `CONFIDENTIAL · ${meta.traceId} · ${meta.releasedBy}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildWatermarkedPrintHtml(
  bodyInnerHtml: string,
  meta: WatermarkMeta,
  title?: string,
): string {
  const banner = escapeHtml(watermarkBannerText(meta));
  const repeat = escapeHtml(watermarkRepeatText(meta));
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title ?? meta.examTitle)}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; position: relative; }
    .wm-page { position: relative; min-height: 100vh; }
    .wm-overlay {
      position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background-image: repeating-linear-gradient(
        -35deg,
        transparent,
        transparent 80px,
        rgba(220, 38, 38, 0.04) 80px,
        rgba(220, 38, 38, 0.04) 81px
      );
    }
    .wm-overlay-text {
      position: fixed; inset: 0; pointer-events: none; z-index: 0;
      display: flex; flex-wrap: wrap; align-content: flex-start; gap: 48px 64px;
      padding: 40px; opacity: 0.07; font-size: 13px; font-weight: 700;
      color: #991b1b; letter-spacing: 0.08em; text-transform: uppercase;
      transform: rotate(-24deg); overflow: hidden;
    }
    .wm-strip {
      position: relative; z-index: 2;
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
      padding: 10px 14px; margin-bottom: 16px; font-size: 11px; color: #991b1b;
      line-height: 1.5; font-weight: 600;
    }
    .wm-content { position: relative; z-index: 1; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    .meta { color: #666; font-size: 12px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wm-page">
    <div class="wm-overlay"></div>
    <div class="wm-overlay-text">${repeat} · ${repeat} · ${repeat} · ${repeat} · ${repeat} · ${repeat}</div>
    <div class="wm-strip">${banner}<br/>Unauthorized copying is prohibited. This copy is traceable to the releasing officer.</div>
    <div class="wm-content">
      <h2>${escapeHtml(meta.examTitle)}</h2>
      <p class="meta">Subject: ${escapeHtml(meta.subject)} · Trace ID: ${escapeHtml(meta.traceId)}</p>
      <hr />
      ${bodyInnerHtml}
    </div>
  </div>
</body>
</html>`;
}
