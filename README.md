# Campus Register — College Course Registration

**Team: YW-RegSytems**

**Wail Mohammed and Yesenia Ruiz**

Enterprise Database Web Application, Instructor Tian Zhou

Campus Register turns our college course-registration ER design into a local web application. A registrar can search sections, maintain student and course information, manage registrations and final grades, check rosters and schedules, manage holds and waitlists, and view an enrollment summary. All persistent data is stored in MySQL. Filtering, joins, aggregation, and modifications are SQL operations.

## Prerequisites

- Node.js 18 or newer, with `node` and `npm` available in the terminal.
- MySQL installed locally. Use a MySQL version that enforces `CHECK` constraints (MySQL 8.0.16 or newer).
- A modern browser. See `docs/verification.json` for the browser and operating system actually tested.
- Port 3000 available, or a different `PORT` in `.env`.

This is a local registrar demonstration. It does not provide production authentication, separate student accounts, or a full audit log.

## Start with a separate local MySQL instance

If MySQL is installed but you do not have a working server connection/password, the local helper can initialize a separate database instance under the project directory and use port 3307. It does not change an existing MySQL installation's data or credentials.

```sh
cd /path/to/CollegeCourseRegistration
npm install
npm run local:setup
npm run local:start
```

Follow any paths printed by the helper if your MySQL installation is in a different location. Local database files and credentials are excluded from the submission archive.

## Start with your existing MySQL server

```sh
cd /path/to/CollegeCourseRegistration
npm install
cp .env.example .env
```

Edit `.env` to match your own connection. For example:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-local-password
DB_NAME=college_registration
PORT=3000
```

Then run:

```sh
npm run db:setup
npm start
```

`node index.js` also starts the application. Open **http://localhost:3000/**, or the URL using your chosen `PORT`.

`db:setup` creates the configured database and tables and loads the sample data into an empty database. It does not drop an existing database. Use a new database name if you need a fresh demonstration dataset. The setup account must have permission to create the database/tables; a pre-created database can be used with a suitably privileged local account.

Do not commit or submit `.env`, local MySQL data, or passwords. Submit `.env.example` so another person can supply their own configuration.

## Application tasks

- **Sections:** filter the course offerings by term, department, instructor, or keyword; view section details and rosters.
- **Students:** search and add students including their major, edit the selected student's information, and view registration history/schedules.
- **Courses:** maintain catalog information and prerequisite links.
- **Registrations:** add a registration, change its status, and enter or correct a completed grade.
- **Holds:** place a hold and clear an existing hold.
- **Waitlists:** join a full section's queue, promote its first student when eligible and a seat becomes available, or remove an active entry.
- **Reports:** view enrollment totals calculated by a SQL `GROUP BY` report.

Forms include a cancel action. Browser validation is supplemented by server-side validation, parameterized values, and MySQL constraints. A rejected change should show an error and leave the stored data unchanged.

## Database design and rules

The ten tables are `departments`, `students`, `instructors`, `terms`, `courses`, `sections`, `registrations`, `course_prerequisites`, `waitlist_entries`, and `student_holds`. See `sql/schema.sql`, `docs/er-diagram.svg`, `docs/er-diagram.mmd`, and the PDF report for keys, constraints, functional dependencies, and the 3NF explanation.

- An `ENROLLED` or `COMPLETED` registration occupies a seat. `DROPPED` and `WITHDRAWN` release seats.
- A completed registration must have one of the supported final grades; the other statuses must not have a final grade.
- Only F fails a prerequisite in this project's stated rules. A direct prerequisite must have a completed passing registration before entering `ENROLLED` status.
- Active holds prevent new enrollment. Subsequent holds do not remove an existing registration.
- A section cannot exceed capacity, and capacity cannot be reduced below its occupied seat count.
- A student can waitlist only a full section where the student has no seat. Queue order is joining time, then student ID. Promotion rechecks eligibility and uses a transaction.
- Each student–section pair has at most one registration; a retake uses a different section. Each student–section pair has at most one active waitlist row.
- Prerequisites cannot refer to the same course or form a cycle.

Primary/foreign keys, unique keys, non-null constraints, and checks enforce local row integrity. Transactions and row locks coordinate rules that depend on multiple records. Routine application actions should use the browser/API rather than bypassing these checks with direct SQL edits.

## Tests and persistence

```sh
npm test
npm run test:integration
npm run test:browser
```

Database/browser verification details and limitations are recorded in `docs/verification.json` and summarized in the PDF report. Integration tests require a local MySQL connection; use only the documented test setup and a separate test database. Do not use a database containing your own records for test fixtures.

For a manual persistence check, insert or update a record in the interface, note its ID, reload the page, and search for that same record. A matching `SELECT` in MySQL Workbench can also confirm the stored value. The demonstration must show actual persisted modifications rather than only success notifications.

## Report and submission

- `report.pdf`: report draft; when a team ID is provided, the generator names it `teamXY.pdf` as required.
- `docs/er-diagram.mmd`: editable ER diagram source.
- `docs/er-diagram.svg`: diagram suitable for viewing without Mermaid tooling.
- `sql/schema.sql`: schema creation with constraints.
- `sql/seed.sql`: sample data.
- `docs/feature-queries.sql`: representative SQL for required features.
- `docs/DEMO_SCRIPT.txt`: a demonstration plan lasting about 6 minutes 30 seconds.
- `docs/submission.json`: team ID, authors, and demo-video URL used by the report generator.
- `docs/verification.json`: actual test environment, results, and limitations.

**Demo video:** not recorded/linked yet. Before submitting, record a video no longer than seven minutes, make it viewable by the instructor, and enter its URL in `docs/submission.json` and here. Also set the team ID so the final report has the required name. The application and report do not invent a video link.

To rebuild the report (Python 3 and Google Chrome installed; set CHROME_BIN if needed):

```sh
npm run report
```

The PDF report must contain the same viewable demo link as the README. Check the final filename and remove draft-only files from your Canvas selection.

## Credits and references

- Team's earlier document: *College Course Registration System (SRS, ER design and DB schema)*, Wail Mohammed and Yesenia Ruiz.
- Instructor's `TodoMySQL` starter: Express server, public HTML/CSS/JavaScript organization, and MySQL DAO/repository pattern. The registration schema, workflows, interface, validation, reports, and documentation were adapted for this project.
- Node.js: https://nodejs.org/en/docs
- Express: https://expressjs.com/
- mysql2: https://sidorares.github.io/node-mysql2/docs
- MySQL Reference Manual: https://dev.mysql.com/doc/refman/8.4/en/
- Codex/ChatGPT assistance was used to implement, document, and test the application from the team's design. Review the source and understand each query and workflow before demonstrating it.

No remote website publication is required; the project is designed for local MySQL and a local browser.


## Alignment with this class and the professor’s feedback

The ten-entity database-class SRS and final ER/schema govern this implementation. Read [the requirement mapping](docs/REQUIREMENT_TRACEABILITY.md) and [the explicit relationship constraints](docs/RELATIONSHIPS.md). The revised diagram uses consistent Crow’s Foot notation: each child has exactly one parent, while a parent may have zero or many children. Both prerequisite roles are named. The existing major attribute is retained as one optional student value. Unique pair constraints remain in force.

The RISE-EDU archive is the earlier Java/Swing/CSV enrollment project. Its enrollment, holds, waitlist, schedule, and reporting workflows inform the application; this class requires JavaScript/HTML/CSS and local MySQL. The [adaptation record](docs/RISE_EDU_ADAPTATION.md) explains that scope. The original archive and class design document are not changed.

Integration and browser checks create uniquely named temporary databases and remove only those databases. They require a setup account with CREATE/DROP DATABASE permissions on your local test server. The separate helper instance provides such a local demonstration account. Tests never reset the configured demonstration database. Chrome tests use headless desktop Chrome and a narrow viewport; this is not proof of physical iPhone/Android testing.

For an older project database missing the major column, back it up, then run `sql/migrations/001_student_major.sql` once in MySQL Workbench. A new installation already includes the field. The setup command preserves existing records and will not silently migrate or reseed an older schema.

After using the separate local instance, stop the app with Ctrl+C. Run `npm run local:stop` to stop only the helper’s MySQL instance. If your MySQL binaries are elsewhere, set MYSQLD to the mysqld executable before local:setup. The helper does not install MySQL, change the system server, or modify its password.
