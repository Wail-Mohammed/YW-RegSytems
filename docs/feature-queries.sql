-- Academic Registration Portal: representative prepared statements for the required features.
-- '?' is a bound value supplied through mysql2, not string concatenation.

-- 1. Search sections and display joined catalog, department, term, and instructor.
-- A keyword is supplied as '%keyword%' to each LIKE placeholder.
SELECT s.section_id, c.course_code, c.title, c.credits, d.name AS department,
       t.name AS term_name, t.year, s.section_number, s.meeting_time,
       s.location, s.capacity,
       CONCAT(i.first_name, ' ', i.last_name) AS instructor,
       (SELECT COUNT(*) FROM registrations r
        WHERE r.section_id = s.section_id
          AND r.status IN ('ENROLLED','COMPLETED')) AS occupied_seats
FROM sections s
JOIN courses c ON c.course_id = s.course_id
JOIN departments d ON d.department_id = c.department_id
JOIN terms t ON t.term_id = s.term_id
JOIN instructors i ON i.instructor_id = s.instructor_id
WHERE (c.course_code LIKE ? OR c.title LIKE ?)
  AND s.term_id = ?
ORDER BY c.course_code, s.section_number;

-- 2. Student schedule/history: joins stored registrations to descriptive data.
SELECT r.registration_id, c.course_code, c.title, c.credits,
       s.section_number, t.name AS term_name, t.year,
       s.meeting_time, s.location, r.status, r.final_grade
FROM registrations r
JOIN sections s ON s.section_id = r.section_id
JOIN courses c ON c.course_id = s.course_id
JOIN terms t ON t.term_id = s.term_id
WHERE r.student_id = ?
ORDER BY t.year DESC, t.start_date DESC, c.course_code;

-- 3. Roster: identifies the students attached to one selected section.
SELECT r.registration_id, st.student_id, st.first_name, st.last_name,
       st.email, r.status, r.final_grade
FROM registrations r
JOIN students st ON st.student_id = r.student_id
WHERE r.section_id = ?
ORDER BY st.last_name, st.first_name, st.student_id;

-- 4. Summary report: SQL grouping and conditional aggregation.
-- LEFT JOIN retains sections with zero registrations.
SELECT d.department_id, d.name AS department, c.course_id, c.course_code,
       c.title, s.section_id, s.section_number, s.capacity,
       COUNT(r.registration_id) AS registration_records,
       SUM(CASE WHEN r.status IN ('ENROLLED','COMPLETED') THEN 1 ELSE 0 END)
         AS occupied_seats,
       SUM(CASE WHEN r.status = 'ENROLLED' THEN 1 ELSE 0 END) AS enrolled,
       SUM(CASE WHEN r.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
FROM sections s
JOIN courses c ON c.course_id = s.course_id
JOIN departments d ON d.department_id = c.department_id
LEFT JOIN registrations r ON r.section_id = s.section_id
WHERE s.term_id = ?
GROUP BY d.department_id, d.name, c.course_id, c.course_code, c.title,
         s.section_id, s.section_number, s.capacity
ORDER BY d.name, c.course_code, s.section_number;

-- 5. INSERT and UPDATE cover two distinct tables.
INSERT INTO students (first_name, last_name, email, major) VALUES (?, ?, ?, ?);
UPDATE students SET first_name = ?, last_name = ?, email = ?, major = ?
WHERE student_id = ?;
INSERT INTO courses (department_id, course_code, title, credits)
VALUES (?, ?, ?, ?);
UPDATE courses SET department_id = ?, course_code = ?, title = ?, credits = ?
WHERE course_id = ?;

-- 6. Examples used while checking enrollment in a transaction.
SELECT section_id, capacity FROM sections WHERE section_id = ? FOR UPDATE;
SELECT COUNT(*) AS occupied_seats FROM registrations
WHERE section_id = ? AND status IN ('ENROLLED','COMPLETED');
SELECT hold_id FROM student_holds
WHERE student_id = ? AND cleared_at IS NULL;
SELECT cp.prerequisite_id
FROM course_prerequisites cp
WHERE cp.course_id = ?
  AND NOT EXISTS (
    SELECT 1 FROM registrations r
    JOIN sections s ON s.section_id = r.section_id
    WHERE r.student_id = ? AND s.course_id = cp.prerequisite_id
      AND r.status = 'COMPLETED' AND r.final_grade <> 'F'
  );

-- 7. Active waitlist positions are derived, not stored redundantly.
SELECT w.student_id, w.section_id, w.joined_at,
       ROW_NUMBER() OVER (PARTITION BY w.section_id
                          ORDER BY w.joined_at, w.student_id) AS position
FROM waitlist_entries w
WHERE w.section_id = ?
ORDER BY w.joined_at, w.student_id;
