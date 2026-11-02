import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Bookmark, BookOpen, Settings2, Languages } from 'lucide-react';
import { Toaster } from 'sonner';
import './App.css';
import './table.css';
import './pages.css';
import { api } from './lib/api';
import { copy } from './lib/i18n';
import { Home, CategoryPage, ExamPage, SavedPage } from './components/Pages';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';

function Header({ t, lang, setLang, savedCount }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/" data-testid="brand-home">
        <span className="brand-mark">S</span>
        <span>
          Sarkari<span>PYQ</span>
          <small>OFFICIAL PAPER LIBRARY</small>
        </span>
      </Link>

      <nav>
        <NavLink end to="/" data-testid="nav-library">
          <BookOpen size={16} />
          {t.library}
        </NavLink>

        <NavLink to="/saved" data-testid="nav-saved">
          <Bookmark size={16} />
          {t.saved}
          <b>{savedCount}</b>
        </NavLink>

        <NavLink to="/admin" data-testid="nav-admin">
          <Settings2 size={16} />
          {t.admin}
        </NavLink>

        <button
          className="lang"
          onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
          data-testid="language-toggle"
        >
          <Languages size={16} />
          {lang === 'en' ? 'हिंदी' : 'English'}
        </button>
      </nav>
    </header>
  );
}

function AdminRoute({ data, refresh }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('admin-token')) return setUser(false);

    api.get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem('admin-token');
        setUser(false);
      });
  }, []);

  const logout = () => {
    localStorage.removeItem('admin-token');
    setUser(false);
  };

  if (user === null) {
    return (
      <section className="content">
        <p className="muted">Checking session…</p>
      </section>
    );
  }

  return user
    ? <AdminPanel data={data} refresh={refresh} onLogout={logout} />
    : <AdminLogin onLogin={setUser} />;
}

export default function App() {
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'en'
  );

  const [data, setData] = useState({
    categories: [],
    exams: [],
    papers: []
  });

  const [saved, setSaved] = useState(
    () => JSON.parse(localStorage.getItem('saved-papers') || '[]')
  );

  const t = copy[lang];

  const refresh = useCallback(async () => {
    const [c, e, p] = await Promise.all([
      api.get('/categories'),
      api.get('/exams'),
      api.get('/papers')
    ]);

    setData({
      categories: c.data,
      exams: e.data,
      papers: p.data
    });

    setSaved((s) =>
      s.map((x) => p.data.find((y) => y.id === x.id)).filter(Boolean)
    );
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem('saved-papers', JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleSave = (p) =>
    setSaved((s) =>
      s.some((x) => x.id === p.id)
        ? s.filter((x) => x.id !== p.id)
        : [...s, p]
    );

  const props = { data, lang, t, saved, toggleSave };

  return (
    <BrowserRouter>
      <div className="shell">
        <Header
          t={t}
          lang={lang}
          setLang={setLang}
          savedCount={saved.length}
        />

        <main>
          <Routes>
            <Route path="/" element={<Home {...props} />} />
            <Route path="/category/:id" element={<CategoryPage {...props} />} />
            <Route path="/exam/:id" element={<ExamPage {...props} />} />
            <Route path="/saved" element={<SavedPage {...props} />} />
            <Route
              path="/admin"
              element={<AdminRoute data={data} refresh={refresh} />}
            />
          </Routes>
        </main>

        <footer>
          Built for focused preparation <span>•</span> Official papers, clearer revision
        </footer>

        <Toaster position="top-right" richColors />
      </div>
    </BrowserRouter>
  );
}
