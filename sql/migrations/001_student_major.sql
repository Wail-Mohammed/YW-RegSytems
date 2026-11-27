-- Only for an older project database that lacks students.major.
-- Back up that database first. Fresh installations use sql/schema.sql instead.
ALTER TABLE students ADD COLUMN major VARCHAR(120) NULL AFTER email,
  ADD CONSTRAINT ck_students_major CHECK (major IS NULL OR CHAR_LENGTH(TRIM(major)) > 0);
