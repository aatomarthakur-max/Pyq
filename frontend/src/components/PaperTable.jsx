import { Bookmark, BookmarkCheck, Download, ExternalLink, BookOpen } from 'lucide-react';
import { fileUrl } from '../lib/api';

export const Empty = ({ title, hint }) => (
  <div className="empty" data-testid="empty-state">
    <BookOpen size={28} />
    <strong>{title}</strong>
    {hint && <p>{hint}</p>}
  </div>
);

export function PaperTable({ list, t, saved, toggleSave, examName }) {
  if (list.length === 0) return <Empty title={t.empty} hint={t.emptyHint} />;

  return (
    <div className="paper-table-wrap" data-testid="paper-table">
      <div className="paper-table pyq-table" role="table" aria-label="Previous year papers">
        <div className="paper-row paper-head" role="row">
          <span>{t.year}</span>
          <span>{t.paper}</span>
          <span>{t.subject}</span>
          <span>{t.language}</span>
          <span>{t.actions}</span>
        </div>

        {list.map((p) => (
          <PaperRow
            key={p.id}
            p={p}
            t={t}
            isSaved={saved.some((x) => x.id === p.id)}
            toggleSave={toggleSave}
            examName={examName?.(p)}
          />
        ))}
      </div>
    </div>
  );
}

function PaperRow({ p, t, isSaved, toggleSave, examName }) {
  return (
    <article className="paper-row" role="row" data-testid={`paper-row-${p.id}`}>
      <span className="year-cell">{p.year}</span>

      <div className="paper-title-cell">
        <div className="pdf-icon">PDF</div>
        <div>
          <h3>{p.title}</h3>
          {examName && <small className="exam-chip">{examName}</small>}
          {p.about && <p className="paper-about">{p.about}</p>}
        </div>
      </div>

      <span className="subject-cell">{p.subject}</span>
      <span className="language-cell">{p.language}</span>

      <div className="row-actions">
        <a
          className="view-link"
          href={fileUrl(p)}
          target="_blank"
          rel="noreferrer"
          data-testid={`view-paper-${p.id}`}
        >
          {t.view}
          <ExternalLink size={14} />
        </a>

        {p.file_path && (
          <a
            className="dl-btn"
            href={fileUrl(p, true)}
            download
            data-testid={`download-paper-${p.id}`}
          >
            <Download size={14} />
            {t.download}
          </a>
        )}

        <button
          className="save-btn"
          onClick={() => toggleSave(p)}
          data-testid={`save-paper-${p.id}`}
        >
          {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          <span>{isSaved ? t.remove : t.save}</span>
        </button>
      </div>
    </article>
  );
}
