import { useState } from 'react';
import { Trash2, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorText, fileUrl } from '../lib/api';
import { PaperUploadForm } from './PaperUploadForm';

const EMPTY = {
  name: '',
  name_hi: '',
  conducting_body: '',
  official_website: '',
  about: '',
  about_hi: ''
};

export function ExamManager({ exam, draft, data, refresh, onSelect }) {
  const [form, setForm] = useState(exam ? { ...EMPTY, ...exam } : { ...EMPTY, ...draft });
  const [busy, setBusy] = useState(false);
  const papers = data.papers.filter((p) => p.exam_id === exam?.id);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: saved } = exam
        ? await api.put(`/exams/${exam.id}`, form)
        : await api.post('/exams', form);
      toast.success('Exam details saved');
      await refresh();
      onSelect(saved.id);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removeExam = async () => {
    if (!window.confirm(`Delete "${exam.name}" and all its papers?`)) return;
    try {
      await api.delete(`/exams/${exam.id}`);
      toast.success('Exam deleted');
      onSelect(null);
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="exam-manager">
      <form className="panel" onSubmit={save} data-testid="exam-form">
        <div className="panel-head">
          <h3>{exam ? 'Exam details' : 'New exam'}</h3>
          {exam && (
            <button
              type="button"
              className="danger-link"
              onClick={removeExam}
              data-testid="delete-exam-button"
            >
              <Trash2 size={14} />
              Delete exam
            </button>
          )}
        </div>

        <select
          required
          value={form.category_id}
          onChange={set('category_id')}
          data-testid="exam-category-select"
        >
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="two">
          <input
            required
            placeholder="Exam name e.g. SSC CGL"
            value={form.name}
            onChange={set('name')}
            data-testid="exam-name-input"
          />
          <input
            placeholder="Hindi name"
            value={form.name_hi}
            onChange={set('name_hi')}
            data-testid="exam-name-hi-input"
          />
        </div>

        <div className="two">
          <input
            placeholder="Conducting body e.g. Staff Selection Commission"
            value={form.conducting_body}
            onChange={set('conducting_body')}
            data-testid="exam-body-input"
          />
          <input
            type="url"
            placeholder="Official website https://..."
            value={form.official_website}
            onChange={set('official_website')}
            data-testid="exam-website-input"
          />
        </div>

        <label className="field-label">
          About the exam (English) — shown on top of exam page, helps Google search
          <textarea
            rows={7}
            placeholder="Eligibility, exam pattern, syllabus, selection process, important dates..."
            value={form.about}
            onChange={set('about')}
            data-testid="exam-about-input"
          />
        </label>

        <label className="field-label">
          About the exam (Hindi)
          <textarea
            rows={4}
            value={form.about_hi}
            onChange={set('about_hi')}
            data-testid="exam-about-hi-input"
          />
        </label>

        <button className="submit" disabled={busy} data-testid="save-exam-button">
          <Save size={15} />
          {busy ? 'Saving…' : 'Save exam details'}
        </button>
      </form>

      {exam && (
        <>
          <PaperUploadForm examId={exam.id} refresh={refresh} />

          <div className="panel" data-testid="admin-paper-list">
            <div className="panel-head">
              <h3>Uploaded papers ({papers.length})</h3>
            </div>

            {papers.length === 0 ? (
              <p className="muted">No papers yet. Upload the first one above.</p>
            ) : (
              papers.map((p) => (
                <AdminPaperRow key={p.id} p={p} refresh={refresh} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AdminPaperRow({ p, refresh }) {
  const [edit, setEdit] = useState(null);

  const remove = async () => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try {
      await api.delete(`/papers/${p.id}`);
      toast.success('Paper deleted');
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const save = async () => {
    try {
      await api.put(`/papers/${p.id}`, {
        ...edit,
        year: Number(edit.year)
      });
      toast.success('Paper updated');
      setEdit(null);
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (edit) {
    return (
      <div className="admin-paper editing" data-testid={`admin-paper-edit-${p.id}`}>
        <div className="two">
          <input
            value={edit.title}
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            data-testid="edit-paper-title"
          />
          <input
            type="number"
            value={edit.year}
            onChange={(e) => setEdit({ ...edit, year: e.target.value })}
            data-testid="edit-paper-year"
          />
        </div>

        <div className="two">
          <input
            value={edit.subject}
            onChange={(e) => setEdit({ ...edit, subject: e.target.value })}
          />
          <input
            value={edit.language}
            onChange={(e) => setEdit({ ...edit, language: e.target.value })}
          />
        </div>

        <textarea
          rows={3}
          value={edit.about}
          onChange={(e) => setEdit({ ...edit, about: e.target.value })}
          data-testid="edit-paper-about"
        />

        <div className="row-btns">
          <button className="submit" onClick={save} data-testid="save-paper-edit">
            <Save size={14} />
            Save
          </button>
          <button className="ghost-btn" onClick={() => setEdit(null)}>
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-paper" data-testid={`admin-paper-${p.id}`}>
      <span className="year-cell">{p.year}</span>

      <div>
        <strong>{p.title}</strong>
        <small>
          {p.subject} · {p.language}
          {p.file_size ? ` · ${(p.file_size / 1048576).toFixed(1)} MB` : ''}
        </small>
      </div>

      <a href={fileUrl(p)} target="_blank" rel="noreferrer" className="view-link">
        Open
      </a>

      <button
        onClick={() => setEdit({
          title: p.title,
          year: p.year,
          subject: p.subject,
          language: p.language,
          about: p.about || ''
        })}
        data-testid={`edit-paper-${p.id}`}
      >
        <Pencil size={14} />
      </button>

      <button onClick={remove} data-testid={`delete-paper-${p.id}`}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
