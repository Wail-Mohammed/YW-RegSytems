# Database design and implementation notes

The team's College Course Registration SRS, ER diagram, and relational schema govern this application. The implementation retains all ten relations and the original student-section uniqueness rules. Original requirements are reproduced in PROJECT_REQUIREMENTS.md and mapped to features in REQUIREMENT_TRACEABILITY.md.

## Clarifying the relationships

The revised diagram consistently uses Crow's Foot notation. Each NOT NULL foreign key requires exactly one parent; each parent can have zero or many children. Both course-prerequisite roles are named. RELATIONSHIPS.md explains every direction and participation constraint. This addresses the instructor's feedback without inventing new minimum participation rules.

## Documented schema refinements

- Plural snake_case names give SQL tables and attributes a consistent style.
- A unique course_code provides a readable catalog label alongside course_id.
- registration_id selects one registration for editing; UNIQUE(student_id, section_id) preserves the original pair key.
- Student major remains one optional text attribute from the SRS.

## Web implementation

Angular components, reactive forms, signals, and a typed HttpClient service provide the browser interface. TypeScript compiles to JavaScript. Express routes requests, Repository.js performs SQL and transactions, and DAO.js manages MySQL connections. Filtering, joins, aggregation, and persistence run in MySQL.

The professor's TodoMySQL example informs the Express/MySQL structure. Angular sources live in client/src and compile to dist/frontend/browser. The example database name and todo fields are not part of this team's domain design.

The application assumes an authorized local registrar. It implements the stated registration, prerequisite, hold, capacity, grade, and waitlist rules; it retains the latest registration status rather than a complete action audit log.
