# Academic Registration Portal

**Wail Mohammed and Yesenia Ruiz**

Team: YW-RegSytems · Database class · Instructor Tian Zhou

This application implements our College Course Registration SRS, ER diagram, and database schema. It lets a registrar manage students, courses, sections, registrations, holds, and waitlists through a browser. Records are stored in local MySQL.

[Report](report.pdf) · [ER diagram](docs/er-diagram.svg) · [Relationship constraints](docs/RELATIONSHIPS.md) · [SQL examples](docs/feature-queries.sql)

[Testing steps](docs/TESTING_GUIDE.md) · [Demo script](docs/DEMO_SCRIPT.txt)

## Setup

Install **Node.js 24.15 or newer in the 24.x series**, MySQL 8.0.16 or newer, and a modern browser. Node 18 cannot build this Angular version.

```sh
git clone https://github.com/Wail-Mohammed/YW-RegSytems.git
cd YW-RegSytems
npm ci
cp .env.example .env
```

Enter the local MySQL host, port, username, password, and database name in `.env`. Start MySQL, then run:

```sh
npm run db:setup
npm start
```

Open **http://localhost:8002/**. `npm start` builds Angular and starts Express. Change `PORT` in `.env` if 8002 is occupied. Ctrl+C stops the application.

In IntelliJ, open this project folder, select Node 24 as the JavaScript runtime, and run the `start` npm script. The IDE terminal can also run the commands above.

Database setup creates the tables and sample records in an empty database. It preserves a complete existing database. The setup account needs permission to create the database and tables. The schema and seed scripts can also be run in MySQL Workbench.

For a separate demonstration MySQL instance, start without an `.env` file and use:

```sh
npm run local:setup
npm run local:start
```

This helper uses port 3307 by default and creates its own configuration and data directory. It preserves an existing `.env`. `npm run local:stop` stops that instance. On Wail's Mac, use `./scripts/npmw` in place of `npm` if the terminal still selects Node 18.

## Features

- Search sections by course text, term, department, instructor, and availability.
- Add and edit students, courses, and sections.
- View section rosters and student registration history using SQL JOINs.
- Enroll students, change registration status, and record final grades.
- Manage student holds, prerequisites, and waitlists.
- View enrollment and available-seat totals calculated with SQL `GROUP BY` and aggregate functions.

Forms include validation, Cancel, and success/error messages. The server validates input again and binds values to SQL parameters. Waitlist promotion checks the first queued student's eligibility before enrolling them.

## Database design

The ten tables are departments, students, instructors, terms, courses, sections, registrations, course_prerequisites, waitlist_entries, and student_holds. The report includes the relational schema, functional dependencies, and 3NF explanation.

The updated Crow's Foot diagram shows each child referencing exactly one parent, while each parent may have zero or many children. Both course-prerequisite roles are labeled. Design refinements include plural SQL names, a unique readable `course_code`, and `registration_id` for selecting a registration to edit. `UNIQUE(student_id, section_id)` preserves the original student–section key. Major remains an optional student attribute.

ENROLLED and COMPLETED registrations occupy seats. New enrollment checks active holds and passing direct prerequisites. Transactions and section locks protect capacity and queue promotion. This is a local registrar application with an assumed authorized operator.

## Code and framework

Angular components render the interface. Reactive forms handle field validation, signals update the view, and an injected HttpClient service calls the API. TypeScript compiles to JavaScript.

`index.js` handles Express routes, `Repository.js` contains SQL and transaction rules, and `DAO.js` manages MySQL connections. Interface sources are in `client/src`; schema and sample data are in `sql/`.

## Testing

```sh
npm test
npm run check
npm run build
npm run test:integration
npm run test:browser
```

Recorded testing used macOS 26.7 and Chrome 158: seven validation scenarios, twelve MySQL integration scenarios, and sixteen browser checks passed. Details are in [verification.json](docs/verification.json). Integration/browser tests use disposable databases and require CREATE/DROP DATABASE permission. Browser tests require Chrome and a completed Angular build.

The narrow-screen check used a 390px emulated viewport. A physical iPhone or Android demonstration is still pending.

## Report and submission

**Demo video:** pending a viewable link; maximum seven minutes.

Set the class team ID and demo URL in `docs/submission.json`, then run `npm run report`. Report generation requires Node.js, Python 3, and Chrome. It produces `team<ID>.pdf`, or `report.pdf` while the ID is unset, and updates the README video link. The video plan is in [DEMO_SCRIPT.txt](docs/DEMO_SCRIPT.txt).

## References

- Wail Mohammed and Yesenia Ruiz, *College Course Registration System SRS, ER Design, and Database Schema*.
- Tian Zhou, `Web_App_Assignment.pdf` and the `TodoMySQL` Express/MySQL example.
- Registration-form and course-search screenshots used as visual references.
- [Angular](https://angular.dev/overview), [version compatibility](https://angular.dev/reference/versions), [reactive forms](https://angular.dev/guide/forms/reactive-forms), and [HttpClient](https://angular.dev/guide/http).
- [Node.js](https://nodejs.org/en/docs), [Express](https://expressjs.com/), [mysql2 prepared statements](https://sidorares.github.io/node-mysql2/docs/examples/queries/prepared-statements), and [MySQL constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).

Codex was used for implementation assistance.
