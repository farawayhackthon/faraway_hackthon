'use client';

import type { WatermarkMeta } from '@/lib/watermark';
import { watermarkBannerText, watermarkRepeatText } from '@/lib/watermark';

interface WatermarkedPaperProps {
  content: string;
  meta: WatermarkMeta;
  isPdf: (s: string) => boolean;
  isImage: (s: string) => boolean;
  isDataUrl: (s: string) => boolean;
  originalFilename?: string;
}

export default function WatermarkedPaper({
  content,
  meta,
  isPdf,
  isImage,
  isDataUrl,
  originalFilename,
}: WatermarkedPaperProps) {
  const banner = watermarkBannerText(meta);
  const repeat = watermarkRepeatText(meta);

  return (
    <div className="watermarked-paper">
      <div className="watermark-strip" role="note">
        <span className="watermark-strip-label">Tamper-evident watermark</span>
        <span>{banner}</span>
        <span className="watermark-strip-note">Trace ID {meta.traceId} · Unauthorized copies are prohibited</span>
      </div>

      <div
        className="watermarked-paper-body"
        style={{ ['--wm-text' as string]: `"${repeat}"` }}
      >
        <div className="watermarked-paper-content">
          {isPdf(content) && (
            <iframe
              src={content}
              width="100%"
              height="800px"
              style={{ border: 'none', display: 'block', position: 'relative', zIndex: 1 }}
              title="Exam Paper PDF"
            />
          )}
          {isImage(content) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content}
              alt="Exam Paper"
              style={{ maxWidth: '100%', display: 'block', margin: '0 auto', position: 'relative', zIndex: 1 }}
            />
          )}
          {isDataUrl(content) && !isPdf(content) && !isImage(content) && (
            <div style={{ padding: 40, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>Binary document — download or print with watermark.</p>
              <a href={content} download={originalFilename || 'document'} className="btn btn-primary">Download Document</a>
            </div>
          )}
          {!isDataUrl(content) && (
            <div className="paper-view-inner">{content}</div>
          )}
        </div>
      </div>
    </div>
  );
}
