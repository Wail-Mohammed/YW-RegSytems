# How the earlier RISE-EDU project is adapted

Source: the team-supplied RISE-EDU-main.zip archive. No GitHub repository URL was supplied. The archive remains unchanged; no Java source, CSV data, real user records, password fields, JARs, or compiled classes are copied into this web submission.

The original README and Java source identify enrollment, dropping/withdrawing, prerequisite checks, schedules, administrative course maintenance, holds, waitlists, and reports as the familiar workflows. Those concepts are reimplemented against this class’s College Course Registration SRS and final ten-entity schema.

| Earlier project | Database-class adaptation |
|---|---|
| Java Swing windows | Browser HTML forms, CSS, and JavaScript |
| Java TCP messages and server | Local Express HTTP API |
| CSV files loaded/saved by DataManager | MySQL transactions committed at each accepted modification |
| Course objects combining catalog and offerings | Separate courses, sections, terms and instructors from the class schema |
| Schedule and enrollment workflows | registrations association with a unique student-section pair, status and grade |
| File-based reports | SQL JOINs, GROUP BY counts, and derived queue positions |
| Prior multi-university/account features | The database-class single-college registrar scope |

The professor’s TodoMySQL sample informs the public/index.html + main.js + style.css, index.js, Repository.js, and DAO.js organization. Its example `test` database name and todo fields are not requirements. The professor explicitly requires this team’s prior database design, local MySQL, parameterized SQL, browser operations, and an updated ER/schema explanation.

This is a conceptual workflow adaptation and a new JavaScript/MySQL implementation of the database-class design. It is not a direct translation of every RISE-EDU feature, and it does not claim that Java/CSV code meets the web assignment. The report identifies these changes and credits the supplied sources.
