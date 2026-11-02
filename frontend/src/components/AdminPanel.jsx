import { useState } from 'react';
import { Plus, Trash2, LogOut, Pencil, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorText } from '../lib/api';
import { PageTitle } from './Pages';
import { ExamManager } from './ExamManager';

export function AdminPanel({ data, refresh, onLogout }) {
  const [examId, setExamId] = useState(null);
  const [catForm, setCatForm] = useState(null);
  const exam = data.exams.find((e) => e.id === examId);
  const newExam = (category_id) => setExamId({ category_id });

  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      if (catForm.id) {
        await api.put(`/categories/${catForm.id}`, catForm);
      } else {
        await api.post('/categories', catForm);
      }
      toast.success('Category saved');
      setCatForm(null);
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const removeCategory = async (c) => {
    if (!window.confirm(`Delete "${c.name}" with all its exams and papers?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      toast.success('Category deleted');
      refresh();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <section className="content admin">
      <div className="admin-top">
        <PageTitle
          eyebrow="CONTROL ROOM"
          title="Manage library"
          sub={`${data.categories.length} categories · ${data.exams.length} exams · ${data.papers.length} papers`}
        />
        <button
          className="ghost-btn"
          onClick={onLogout}
          data-testid="admin-logout-button"
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>

      <div className="admin-grid">
        <aside className="admin-side" data-testid="admin-tree">
          <button
            className="side-add"
            onClick={() => setCatForm({ name: '', name_hi: '', eligibility: '' })}
            data-testid="add-category-button"
          >
            <Plus size={15} />
            Add category
          </button>

          {data.categories.map((c) => (
            <div className="tree-cat" key={c.id}>
              <div className="tree-cat-head">
                <FolderOpen size={14} />
                <strong>{c.name}</strong>

                <button
                  title="Edit"
                  onClick={() => setCatForm(c)}
                  data-testid={`edit-category-${c.id}`}
                >
                  <Pencil size={13} />
                </button>

                <button
                  title="Delete"
                  onClick={() => removeCategory(c)}
                  data-testid={`delete-category-${c.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {data.exams
                .filter((e) => e.category_id === c.id)
                .map((e) => (
                  <button
                    key={e.id}
                    className={`tree-exam ${examId === e.id ? 'on' : ''}`}
                    onClick={() => setExamId(e.id)}
                    data-testid={`admin-exam-${e.id}`}
                  >
                    {e.name}
                    <span>
                      {data.papers.filter((p) => p.exam_id === e.id).length}
                    </span>
                  </button>
                ))}

              <button
                className="tree-add"
                onClick={() => newExam(c.id)}
                data-testid={`add-exam-${c.id}`}
              >
                <Plus size={13} />
                Add exam
              </button>
            </div>
          ))}
        </aside>

        <div className="admin-main">
          {examId ? (
            <ExamManager
              key={exam?.id || 'new'}
              exam={exam}
              draft={typeof examId === 'object' ? examId : null}
              data={data}
              refresh={refresh}
              onSelect={setExamId}
            />
          ) : (
            <div className="admin-hint" data-testid="admin-hint">
              <h3>Choose an exam on the left</h3>
              <p>
                Open an exam to write its details (shown at the top of the exam
                page) and upload as many year-wise PDF papers as you need. Use
                “Add exam” under a category to create a new one.
              </p>
            </div>
          )}
        </div>
      </div>

      {catForm && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={saveCategory}
            data-testid="category-form"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setCatForm(null)}
              data-testid="close-modal"
            >
              ×
            </button>

            <p className="eyebrow">
              {catForm.id ? 'EDIT' : 'NEW'} CATEGORY
            </p>
            <h3>{catForm.id ? 'Edit category' : 'Add category'}</h3>

            <input
              required
              placeholder="Name (English)"
              value={catForm.name}
              onChange={(e) =>
                setCatForm({ ...catForm, name: e.target.value })
              }
              data-testid="category-name-input"
            />

            <input
              placeholder="Name (Hindi)"
              value={catForm.name_hi}
              onChange={(e) =>
                setCatForm({ ...catForm, name_hi: e.target.value })
              }
              data-testid="category-name-hi-input"
            />

            <input
              placeholder="Eligibility e.g. Graduation"
              value={catForm.eligibility}
              onChange={(e) =>
                setCatForm({ ...catForm, eligibility: e.target.value })
              }
              data-testid="category-eligibility-input"
            />

            <button className="submit" data-testid="submit-category">
              Save
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
