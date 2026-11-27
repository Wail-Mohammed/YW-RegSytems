# Database-class requirement → implementation → evidence

The supplied College Course Registration SRS, final ER, and relational schema govern the application. The instructor’s Web_App_Assignment.pdf adds the web, SQL, testing, and submission requirements.

| Requirement | Implementation |
|---|---|
| R01 departments for courses and instructors | NOT NULL department_id foreign keys; course/section joins and department selection fields/filters |
| R02 student id, names, email, major | students table, Student directory, add/edit form, major search; SQL INSERT/UPDATE |
| R03 instructor details | instructors table and seeded data; section instructor selector/filter |
| R04 catalog courses | courses table and catalog add/edit form; credits CHECK 1–6 |
| R05 academic terms | terms table with date/year checks and unique name/year; term selectors |
| R06 one course/instructor/term per section | three NOT NULL FKs; section add/edit form |
| R07 unique section identity | UNIQUE(course_id,term_id,section_number) |
| R08 M:N registration; unique student-section | registrations FKs and UNIQUE pair; enroll/update form |
| R09 timestamp, status, grade | registered_at default, ENUM status, final_grade, registration editor |
| R10 grade iff completed | backend validation, conditional browser grade field, MySQL CHECK |
| R11 student course/section history | Students → Schedule; joined SQL query with student_id parameter |
| R12 section roster | Sections → Roster; registrations JOIN students for selected section |
| R13 instructor teaching assignments | Sections → Instructor filter; SQL instructor_id predicate |
| R14 final grade recording/correction | registration editor selects registration_id; targeted UPDATE |
| R15 prerequisites and no cycles | course_prerequisites, no-self CHECK, recursive SQL cycle detection; catalog prerequisite editor |
| R16 no active hold; passing direct prerequisites | eligibility query inside enrollment/promotion transactions |
| R17 seat count/capacity consistency | section-row lock, SQL COUNT, capacity validation; concurrency test |
| R18 active waitlist pairs; full section only | composite PK, full-seat check, waitlist form and removal action |
| R19 hold id/reason/placed/cleared | student_holds; browser place/clear/reactivate; consistent UTC sessions |
| R20 retakes and derived results | unique pair still allows different sections; schedules, SQL aggregates and ROW_NUMBER queue positions |

P01–P05 are reflected in keys, uniqueness, allowed grades, dates, and values in schema.sql. P06 explicitly permits recording COMPLETED historical results; transitioning into ENROLLED rechecks eligibility. P07 counts ENROLLED and COMPLETED as occupied, including dashboard and report. P08 promotes the oldest joined_at/student_id pair atomically. P09 retains existing registrations after later holds/prerequisite changes. P10 uses RESTRICT foreign keys and preserves association pairs. P11 uses date strings and UTC timestamps. P12 retains the current registration status rather than claiming an action-by-action audit trail.

## Web assignment coverage

| Rubric feature | Browser path / SQL evidence |
|---|---|
| View and SQL-backed search | Sections filters; Student directory and Catalog search |
| INSERT and UPDATE across at least two tables | Students and Course catalog both have add/edit forms; Sections, Registrations and Holds provide additional modification paths |
| Useful JOIN | Section offerings, section roster, student schedule; docs/feature-queries.sql |
| GROUP BY aggregate | Reports → Enrollment and seat availability; Repository.enrollmentReport |
| Backend/browser validation and clear feedback | required/type/range fields; validation.js; database error middleware; visible success/error messages |
| Cancel unfinished forms | Cancel and close controls; browser check verifies no student was inserted |
| Real persistence | fresh-connection SQL SELECT and browser reload after writes |
| Failure cases | missing/invalid values, duplicate email/code/pairs, missing FK, self/cyclic prerequisites, holds, full sections, grade consistency |
| 3NF and functional dependencies | sql/schema-notes.txt and report.pdf |
| Repeatable local setup | .env.example, scripts/setup-db.js, schema.sql, seed.sql, npm scripts |
| Optional frontend framework | Angular standalone components, signals, injected HttpClient, and reactive forms in client/src/app; TypeScript strict/template checks |
| Optional mobile use | Responsive CSS and 390px emulation checked; actual iPhone/Android demonstration remains pending |

Integration tests create a uniquely named temporary database, not the configured demonstration database. Browser checks likewise use a temporary database. `docs/verification.json` records the actual environment and results. Physical phone testing and a recorded viewable video must not be inferred from automated viewport tests.

## Explicit implementation refinements

SQL names use plural snake_case. A unique course_code is a readable catalog label in addition to course_id. A surrogate registration_id is used for selecting one registration for editing; UNIQUE(student_id,section_id) preserves the original pair key. Major is restored from R02, with an explicit nullable single-major assumption. No additional domain tables or relationship minima are invented.

The interface assumes a locally operated registrar workstation and binds to loopback by default. It does not implement a separate authentication/authorization schema or public student accounts. This limitation is stated in the report, consistent with the local demonstration scope.
