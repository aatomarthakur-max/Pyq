export function Home({ data, lang, t, saved, toggleSave }) {
  const [query, setQuery] = useState('');

  useSeo(
    'ExPYQ – Official Previous Year Question Papers PDF',
    'Download official previous year question papers PDF of SSC, UPSC, Teaching, Banking, Railways and State exams in Hindi & English.'
  );

  const results = useMemo(
    () => (query.trim() ? data.papers.filter((p) => matches(p, query)) : []),
    [query, data.papers]
  );

  const examName = (p) =>
    pick(lang, data.exams.find((e) => e.id === p.exam_id), 'name');

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">{t.library}</p>
          <h1>{t.heroTitle}</h1>
          <p className="hero-sub">{t.heroSub}</p>

          <div className="hero-search">
            <Search size={21} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              data-testid="global-search-input"
            />
          </div>
        </div>
      </section>

      <section className="content">
        {query.trim() && (
          <div className="search-results" data-testid="search-results">
            <PageTitle
              eyebrow={t.results}
              title={`${results.length} ${t.papers}`}
            />
            <PaperTable
              list={results}
              t={t}
              saved={saved}
              toggleSave={toggleSave}
              examName={examName}
            />
          </div>
        )}

        <PageTitle
          eyebrow={t.browse}
          title={t.categories}
          sub={`${data.categories.length} ${t.categories} · ${data.exams.length} ${t.exams} · ${data.papers.length} ${t.papers}`}
        />

        <div className="cat-boxes">
          {data.categories.map((c) => (
            <CategoryBox
              key={c.id}
              c={c}
              lang={lang}
              t={t}
              data={data}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function CategoryBox({ c, lang, t, data }) {
  const exams = data.exams.filter((e) => e.category_id === c.id);

  return (
    <div className="cat-box" data-testid={`category-box-${c.id}`}>
      <Link
        to={`/category/${c.id}`}
        className="cat-box-head"
        data-testid={`category-card-${c.id}`}
      >
        <LayoutGrid size={16} />
        {pick(lang, c, 'name')}
      </Link>

      {exams.length === 0 ? (
        <p className="cat-box-empty">{t.noExams}</p>
      ) : (
        <ul>
          {exams.map((e) => (
            <li key={e.id}>
              <Link
                to={`/exam/${e.id}`}
                data-testid={`home-exam-link-${e.id}`}
              >
                {pick(lang, e, 'name')} {t.pyq}
              </Link>
              <span>
                {data.papers.filter((p) => p.exam_id === e.id).length}
              </span>
            </li>
          ))}
        </ul>
      )}

      {c.eligibility && (
        <small className="cat-box-foot">{c.eligibility}</small>
      )}
    </div>
  );
}
