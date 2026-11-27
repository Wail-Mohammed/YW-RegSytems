# Original database-class SRS

Source: the prior design document supplied by Wail Mohammed and Yesenia Ruiz. These are the original requirements and assumptions used to evaluate implementation changes.

College Course Registration System
Software Requirements Specification





1. Purpose
This document outlines the requirements for the College Course Enrollment System. The system allows college registration administrators to maintain course offerings and students to register for course sections. It records teaching assignments and final grades and supports prerequisites, holds, waitlists, and course capacity.
2. Scope
The database represents one college. It stores departments, students, instructors, catalog courses, academic terms, course sections, registrations, prerequisite links, active waitlist entries, and student holds. This phase covers the requirements and database design.
3. Users and Definitions
Student: reviews courses and schedules and requests course enrollment, drop, withdrawal, or waitlist placement.
Registration Administrator: maintain courses, sections, teaching assignments, and holds, review rosters, and record or correct final grades.
Course: a catalog subject with a title and number of credits.
Class Section: a particular offering of a course in an academic term.
Registration: the association between one student and one class section.
4. Functional Requirements
4.1 Student, Course, and Registration Data
R01  The system shall maintain departments and associate each course and instructor with one department.
R02  The system shall store each student’s unique id, first name, last name, email and major.
R03  The system shall store each instructor’s unique id, department, first name, last name, and email.
R04  The system shall store each catalog course’s unique id, department, title, and credit number.
R05  The system shall store each academic term’s id, name, calendar year, start date, and end date.
R06  Each section shall have one course, one instructor, one term, a section number, meeting time, location, and capacity.
R07  A section number shall be unique within a course and term.
R08  A student may register for many sections, and a section may have many students. A student-section pair shall have at most one registration.
R09  Each registration shall record its timestamp, current status, and final grade when completed.
R10  A completed registration shall have a valid final grade. ENROLLED, DROPPED, and WITHDRAWN registrations shall have no final grade.
4.2 Required Queries and Grade Recording
R11  The system shall find the courses and course sections taken by a specified student.
R12  The system shall list the students registered in a specified course section.
R13  The system shall list the course sections taught by a specified instructor.
R14  Authorized staff shall be able to record or correct the final grade for one student-section registration.
4.3 Enrollment, Prerequisites, Holds, and Waitlists
R15  The system shall record course prerequisites and prevent self-references and prerequisite cycles.
R16  The system shall ensure that a student has no active hold and has completed each direct prerequisite with a passing grade before new enrollment.
R17  The number of registrations occupying seats shall not exceed section capacity. Capacity shall not be reduced below the occupied seat count.
R18  A student may join a course section waitlist only when the section is full and the student does not already hold a seat in that section. Each student-section pair shall have at most one active waitlist entry.
R19  The system shall store each student hold’s identifier, reason, placement time, and clearing time when cleared.
R20  The system shall support retaking a course in a different section and derive current schedules, occupied seat counts, and waitlist positions from stored records.
5. Product Assumptions and Constraints
P01  One college is represented. Identifiers are unique within their own tables. Department names and emails within each person table are unique; personal names may repeat.
P02  Each course and instructor belongs to one department. Cross-department teaching is allowed.
P03  Terms are Spring, Summer and Fall. A term name/year pair is unique. Calendar years range from 1900 to 9999; a term’s start date shall not follow its end date.
P04  Credits are whole numbers from 1 through 6. Section capacity is a positive integer. Meeting time and location are stored as text.
P05  Allowed final grades are A, A-, B+, B, B-, C+, C, C-, D+, D, D-, and F. A final grade is unknown until completion.
P06  For this design, F is failing and the other listed grades satisfy prerequisites. Eligibility is checked when entering ENROLLED status. Completed historical results may be imported.
P07  ENROLLED and COMPLETED registrations occupy seats. DROPPED and WITHDRAWN registrations release seats. Posting a final grade preserves the original seat.
P08  Waitlist order is joining time, then student identifier for ties. Promotion removes the queue entry and rechecks eligibility before enrolling the student in one transaction.
P09  A hold remains active until a clearing timestamp is recorded. Later hold or prerequisite changes do not automatically remove existing registrations.
P10  Referenced records shall not be deleted or have their identifiers changed while dependent records exist. Student-section and prerequisite pairs remain fixed; correcting a pair requires replacing that association.
P11  Dates use YYYY-MM-DD. Timestamps use UTC YYYY-MM-DDTHH:MM:SSZ.
P12  Each registration retains its latest status. Retakes use different sections. The model stores course-registration history rather than a complete log of every enrollment action.
