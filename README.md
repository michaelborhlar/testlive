# Graduate Trainee Assessment Platform

A timed online testing platform for graduate trainee screening. Administrators build
papers — title, duration, questions, marks, figures — publish them, and watch scored
results arrive. Candidates sit the test in a focused, mobile-friendly exam screen with a
server-enforced clock.

**Backend:** Django 5 + Django REST Framework (JWT auth)
**Frontend:** React 19 + Vite + Tailwind CSS v4

---

## Documentation

| Guide | What it covers |
| --- | --- |
| [Installation](docs/INSTALLATION.md) | Step-by-step local setup, Windows and macOS/Linux |
| [User guide](docs/USER-GUIDE.md) | Running the platform day to day, admin and candidate |
| [Deployment](docs/DEPLOYMENT.md) | Putting it online — VPS, free hosting, HTTPS, backups |
| [API reference](docs/API.md) | Every endpoint, with request and response shapes |

## Quick start

Two terminals, from the project root.

**Terminal 1 — backend**

```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt && .venv/Scripts/python manage.py migrate && .venv/Scripts/python manage.py seed_demo && .venv/Scripts/python manage.py runserver
```

**Terminal 2 — frontend**

```bash
cd frontend && npm install && npm run dev
```

Open <http://localhost:5173> and sign in:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `admin12345` |
| Candidate | `candidate` | `candidate12345` |

Full instructions, including macOS/Linux paths, are in
[docs/INSTALLATION.md](docs/INSTALLATION.md).

---

## What it does

### For administrators

- **Build tests** — title, description, briefing instructions, duration, pass mark and
  attempts allowed.
- **Question bank** — single choice, multiple choice, true/false and typed short answers,
  each with its own mark value, hint and explanation.
- **Figures** — attach a graph, chart or diagram to any question. Candidates can tap it to
  enlarge.
- **Import from a document** — upload a PDF or Word paper and the questions, options,
  answer key and embedded graphs are read out of it automatically. Review what was found,
  tick the ones you want, and they drop into the editor. Runs entirely on your own machine
  at no cost.
- **Serve a subset** — keep 100 questions in the pool and serve 20 to each candidate,
  optionally shuffled.
- **Calculator** — switch an on-screen calculator on or off per test.
- **Results** — pass rates, average scores and a per-question breakdown of every attempt.
- **Proctoring settings** — the configuration is in place and shown to candidates;
  camera capture itself is not built yet (see below).

### For candidates

- A briefing screen with the rules before the clock starts.
- One question at a time, with the question numbers running along the bottom of the screen
  showing which are answered, open or flagged.
- Answers save automatically as you go; refreshing does not lose work or buy extra time.
- Flag questions to revisit, then a submit summary showing what is still unanswered.
- Automatic submission when the timer reaches zero.
- Immediate score and per-question review, if the administrator has enabled it.

---

## Project layout

```
Micproject/
├── backend/                  Django + DRF API
│   ├── config/               settings, urls, wsgi/asgi
│   ├── accounts/             custom user model, JWT auth
│   ├── exams/                tests, questions, attempts, marking
│   │   ├── models.py         Test, Question, Choice, Attempt, Answer
│   │   ├── importer.py       PDF/Word reader and question parser
│   │   ├── serializers.py    admin vs candidate views of the data
│   │   └── views.py          API endpoints
│   ├── media/                uploaded question figures
│   └── requirements.txt
├── frontend/                 React + Vite app
│   └── src/
│       ├── pages/admin/      dashboard, test editor, results
│       ├── pages/candidate/  catalogue, briefing, exam runner, results
│       ├── components/       UI kit, calculator, import modal
│       └── api/client.js     axios instance with token refresh
└── docs/                     the guides listed above
```

## How marking works

Marking happens on the server when the attempt is submitted, never in the browser:

- **Single choice / true-false** — full marks when the selected option is the correct one.
- **Multiple choice** — full marks only when the selected set exactly matches the key;
  partial selections score zero.
- **Short answer** — the typed text is compared against the accepted answers, ignoring
  case and surrounding spaces.

The clock is enforced server-side too. Each attempt stores an `expires_at`, and any
attempt opened or submitted after that time is graded as *timed out* using the answers
saved up to that point.

## Not built yet

Two things are deliberately scaffolded rather than finished, pending your direction:

1. **Live camera proctoring** — the per-test settings (require camera, require full
   screen, flag tab switching, snapshot interval) save and appear on the candidate
   briefing, but no capture, streaming or invigilator view exists.
2. **SHL-style interactive questions** — the question type system is ready for them; only
   the four standard types are implemented.
