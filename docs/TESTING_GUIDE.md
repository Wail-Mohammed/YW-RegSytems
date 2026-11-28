# Academic Registration Portal: testing steps

Use new demonstration records for these checks. Leave the existing course, student, and registration records unchanged.

## 1. Start the app

Open the project in IntelliJ, select **YW-RegSytems**, and click **Run**. The run configuration uses Node 24. On Wail's Mac, the IDE terminal can also run:

```sh
./scripts/npmw start
```

MySQL must be running. Open **http://localhost:8002/** in Chrome. If the app was already open before an update, restart it and reload the page.

## 2. Prepare your test values

Use these values for the first practice run:

| Record | Values |
|---|---|
| Student | First name: `Taylor`; last name: `Demo`; email: `taylor.demo.01@example.edu`; major: `Computer Science` |
| Course | Code: `DEMO 900`; department: `Computer Science`; title: `Registration Demo`; credits: `3` |
| Course update | Change the title to `Registration Demo Updated` and credits to `4` |

If that email or course code already exists, use `taylor.demo.02@example.edu` and `DEMO 901`. Use your chosen values consistently in the checks and SQL queries below. A repeated practice run does not require resetting the database.

## 3. Check the required features

| Check | What to do | What should happen |
|---|---|---|
| Search | Open **Sections**. Search for `Database`, select **Fall 2026** and **Computer Science**, and click **Search**. | Database Systems appears with its section, instructor, schedule, and seats. |
| JOIN | Click **Roster** on that section. | The dialog shows students and their registrations for the selected section. Click **Close**. |
| Student INSERT | Open **Students** → **Add student**. Enter the student values above and click **Add student**. | A success message appears. Search for the email and find the new row. |
| Course INSERT | Open **Course catalog** → **Add course**. Enter the course values above and click **Add course**. | The new course appears when you search for `DEMO 900`. |
| Targeted UPDATE | Click the pencil beside that new course. Change its title and credits as shown above, then click **Save course**. | Only the selected course has the new title and four credits. |
| Persistence in the browser | Reload the page. Search for the demo student and course again. | Both records remain, and the course retains the update. |
| GROUP BY report | Open **Reports**, select **Fall 2026**, and click **Search**. | A section summary shows enrolled, completed, occupied, available, and waitlisted totals. |
| Missing input | Open **Students** → **Add student** and submit the empty form. | Required-field messages appear; no student is saved. |
| Invalid value | Fill an **Add course** form with a new code such as `DEMO 902`, a department and title, then enter `7` credits and try to submit. | The form rejects the value; allowed credits are 1–6. Click **Cancel**. |
| Duplicate key | Try adding another student with the demo email and otherwise valid names. | An error says the record already exists. Click **Cancel**. |
| Cancel | Start a student named `Cancel Demo`, then click **Cancel** before saving. Search for that name. | No new Cancel Demo row appears. |

## 4. Confirm the same records in MySQL

Open MySQL Workbench and use the connection for this app. On Wail's configured demonstration instance, the host is `127.0.0.1` and the database port is `3307`. Other installations should use the connection values in their own `.env`. The app's browser port, **8002**, is separate from the MySQL port.

Prepare the connection before recording. Keep passwords and the `.env` file off screen.

Run these two read-only queries in a SQL tab:

```sql
SELECT student_id, first_name, last_name, email, major
FROM college_registration.students
WHERE email = 'taylor.demo.01@example.edu';

SELECT course_id, course_code, title, credits
FROM college_registration.courses
WHERE course_code = 'DEMO 900';
```

The first query should return Taylor Demo. The second should show `Registration Demo Updated` with `4` credits. Change the email/code in the queries if you chose different practice values. If a query returns no rows, check that Workbench uses the same database connection and values as the app.

## 5. Run the automated checks when needed

In the project terminal on Wail's Mac:

```sh
./scripts/npmw test
./scripts/npmw run check
./scripts/npmw run build
./scripts/npmw run test:integration
./scripts/npmw run test:browser
```

Each command should finish successfully. Integration and browser tests create separate temporary databases; they do not reset the demonstration database. They need an account with permission to create/drop those databases. Browser checks need Chrome. The integration checks also cover invalid foreign-key references, capacity, holds, prerequisites, and queue promotion.

## Before submission

Record the steps in [DEMO_SCRIPT.txt](DEMO_SCRIPT.txt), keeping the video under seven minutes. Add its viewable link and the class team ID to `docs/submission.json`, then run `./scripts/npmw run report` and check the resulting `team<ID>.pdf` and README video link. Confirm the instructor can open the video.

For the optional mobile credit, demonstrate the required features on a real iPhone or Android and record the device/browser used. The existing narrow-window browser check alone is not a phone demonstration.
