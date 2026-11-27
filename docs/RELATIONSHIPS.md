# Clarifying the professor’s relationship-constraint feedback

The database-class SRS and final ER/schema are the basis of this implementation. The updated diagram uses one notation consistently: Crow’s Foot. `||` means exactly one (1..1); `o{` means zero or many (0..N). Read the symbol next to an entity as the number of those entities related to one entity at the other end.

| Parent → child | Children for one parent | Parents for one child | Enforced reference / SRS |
|---|---|---|---|
| departments → courses | 0..N | exactly 1 | courses.department_id; R01 |
| departments → instructors | 0..N | exactly 1 | instructors.department_id; R01 |
| courses → sections | 0..N | exactly 1 | sections.course_id; R06 |
| instructors → sections | 0..N | exactly 1 | sections.instructor_id; R06 |
| terms → sections | 0..N | exactly 1 | sections.term_id; R06 |
| students → registrations | 0..N | exactly 1 | registrations.student_id; R08 |
| sections → registrations | 0..N | exactly 1 | registrations.section_id; R08 |
| students → waitlist_entries | 0..N | exactly 1 | waitlist_entries.student_id; R18 |
| sections → waitlist_entries | 0..N | exactly 1 | waitlist_entries.section_id; R18 |
| students → student_holds | 0..N | exactly 1 | student_holds.student_id; R19 |
| courses → course_prerequisites, dependent role | 0..N | exactly 1 | course_prerequisites.course_id; R15 |
| courses → course_prerequisites, required role | 0..N | exactly 1 | course_prerequisites.prerequisite_id; R15 |

All these child references are `NOT NULL` foreign keys. Every child participates totally in its parent relationship. A parent can exist without children, so its participation is partial. A department need not already have courses; an instructor need not already teach a section; a student need not already have a registration. None of the SRS requirements justifies a 1..N minimum for those parent-to-child relationships.

A student registers for a **section**, which identifies its catalog course, term, and instructor. The conceptual M:N relationship between students and sections is implemented through registrations. `UNIQUE(student_id, section_id)` ensures one registration per pair while allowing a retake in another section. The waitlist is a separate M:N association with a composite primary key. Registration and waitlist membership have different meanings and are not duplicate relationships.

The recursive prerequisite relationship uses two named roles. For example, `(course_id=2, prerequisite_id=1)` means CS 201 requires CS 101. It does not mean CS 101 requires CS 201. Both columns reference courses; their composite key prevents duplicate prerequisite links. The database rejects self-reference; the transaction checks cycles.

Major remains one optional student attribute because the original schema models it that way. No student–department relationship or new major entity is introduced. `NULL` means undeclared. Final grades and hold-clearing times are also nullable for the reasons stated in the SRS.

Section capacity, prerequisite satisfaction, active holds, and waitlist FIFO are business constraints across multiple rows. They are explained separately from static ER cardinalities and enforced in transactions. For example, a section’s 0..N registrations include dropped/history rows; capacity limits only ENROLLED and COMPLETED records under P07.

The readable diagram is `er-diagram.svg`; `er-diagram.mmd` is editable Mermaid source. `sql/schema.sql` specifies every actual attribute, key, and constraint. Naming refinements and the two implementation identifiers are explained in the report rather than being presented as unchanged original design choices.
