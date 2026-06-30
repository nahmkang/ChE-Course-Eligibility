# ChemEng KMUTT — Course Eligibility

A mobile-friendly web app that checks which courses a Chemical Engineering student can register next semester, based on the grades they just received. Built for three concurrent curricula (student codes 65–66, 67, and 68–69).

## What it does

**For students:**
1. Enter full name + student ID (curriculum auto-detected from the ID prefix)
2. Pick the semester just completed — the app loads that semester's courses
3. Enter grades (A, B+, B, C+, C, D+, D, F, W) and optionally add earlier passed courses
4. See next-semester eligibility: which courses are **Eligible**, **Conditional** (co-requisite must be taken together), or **Locked** (failed/missing prerequisite)
5. See **how many credits the curriculum expects** vs **how many credits the student can actually register**
6. Download a one-page PDF to share with an advisor (saves to phone, send via LINE)

**For admins (you):**
- Password-protected dashboard
- Edit any of the three curricula: add/edit/delete courses, set prerequisites and co-requisites with simple checkboxes, move courses between semesters
- Download the updated `curricula.json` and commit it to GitHub to publish

## Eligibility rules

- **Pass** = grade D or above (F and W do not pass)
- **Prerequisite** = must be passed in an earlier semester. If missing, the dependent course is **Locked**.
- **Co-requisite** = must be passed already OR registered in the same upcoming semester. If it still needs to be taken, the course is **Conditional** ("must register together").

## Files

```
index.html       — all UI and styling
app.js           — logic: eligibility engine, credits, PDF, admin editor
curricula.json   — the data for all three curricula (the "database")
README.md        — this file
```

## Hosting on GitHub Pages (free)

1. Create a GitHub account and a new **public** repository
2. Upload `index.html`, `app.js`, `curricula.json` (and this README)
3. Repository **Settings → Pages → Source:** select `main` branch, root folder, Save
4. Your site goes live at `https://<username>.github.io/<repo>/` within ~2 minutes
5. Optional: add a custom domain in the same Pages settings

To update later: edit a file in GitHub (or re-upload) and the site refreshes within a minute.

## Local testing

The page fetches `curricula.json`, so you can't open it with `file://`. Run a local server:

```bash
cd <folder>
python3 -m http.server 8000
# then open http://localhost:8000
```

## Editing the curricula

1. Open the site, click **Admin**, enter the password
2. Choose which curriculum to edit (65–66, 67, or 68–69) from the dropdown
3. To change a course's prerequisites: click **Edit**, tick/untick courses under Prerequisites or Co-requisites, **Save**
4. To add a course: **+ Add Course**, fill in the fields, set its semester and requirements
5. When done, click **Download curricula.json**
6. In your GitHub repo, open `curricula.json`, click the pencil (edit) icon, replace all contents with the downloaded file, and **Commit changes**
7. Within ~1 minute, all students see the updated curriculum

Edits are stored in your browser until you publish, so you won't lose work between sessions. "Discard Edits" reverts to the last published version.

## Admin password

In `app.js`, change `const ADMIN_PASSWORD = "chemeng2025";` to your own password.

**Important:** on a static site, anyone who views the page source can read this password. It only keeps casual users out of the admin screen — it is not real security. For genuine authentication (and to remove the download-and-commit step entirely), migrate to Supabase; the data model is already structured for it.

## Important note on the prerequisite data

The prerequisites were extracted from the department flowcharts and the 2570 curriculum blueprint:
- **Curriculum 68–69** has the most complete data (prerequisites were printed on the flowchart)
- **Curricula 65–66 and 67** use the same course sequence with the older course codes; some links were inferred from the flowchart arrows

**Please review every curriculum in the Admin dashboard and correct anything that doesn't match the official rules.** This is exactly why the editor was built to be quick — you know the real prerequisites better than any diagram. The eligibility engine treats any missing reference safely (as "not yet passed").

## When to upgrade to Supabase

Move to a real database if you want: student accounts that save history, real admin authentication, multiple admins editing at once, or analytics. Supabase's free tier (500 MB Postgres + auth) is more than enough for a department.

## Credits

Designed by Dr. Jatupon Chaiwasu, Department of Chemical Engineering, KMUTT.
