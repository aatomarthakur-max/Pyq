# ExPYQ – PRD

## Original problem
Website (Sarkari Result style) where students download official previous year papers (PDF) of Indian government exams. Categories (Teaching, SSC, UPSC, State civil...) → exams → year-wise papers. Admin manages everything. Students browse/search/view/download/bookmark. English + Hindi.

## Architecture
FastAPI + MongoDB (categories, exams, papers, users, login_attempts); Emergent Object Storage for PDFs; JWT Bearer admin auth (token in localStorage); React + react-router (/, /category/:id, /exam/:id, /saved, /admin).

## Implemented
- Initial: categories/exams/papers CRUD, bilingual UI, bookmarks, table layout
- Jun 2026: renamed to ExPYQ; lighter, faster hero; secure admin login (bcrypt, JWT, lockout after 5 failed tries); admin PDF upload instead of links (can add many papers per exam); "about" text for papers and exams (title/meta set per page for SEO); exam page shows details on top and the papers table below with View/Download/Save; home page shows Sarkari-style category boxes (light blue) with exam links listed in each; table scrolls sideways on mobile; test data removed

## Backlog
- P1: Change admin password from the UI; server-side rendering/sitemap for better SEO
- P2: Latest-updates ticker on home, download counts, more admin users
