-- College Course Registration System
-- Run against the database selected in the application's configuration.
-- No DROP or CREATE DATABASE statements: existing databases are not removed.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE departments (
  department_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (department_id),
  CONSTRAINT uq_departments_name UNIQUE (name),
  CONSTRAINT ck_departments_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE students (
  student_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  major VARCHAR(120) NULL,
  PRIMARY KEY (student_id),
  CONSTRAINT uq_students_email UNIQUE (email),
  CONSTRAINT ck_students_first_name CHECK (CHAR_LENGTH(TRIM(first_name)) > 0),
  CONSTRAINT ck_students_last_name CHECK (CHAR_LENGTH(TRIM(last_name)) > 0),
  CONSTRAINT ck_students_email CHECK (CHAR_LENGTH(TRIM(email)) > 0),
  CONSTRAINT ck_students_major CHECK (major IS NULL OR CHAR_LENGTH(TRIM(major)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE instructors (
  instructor_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  PRIMARY KEY (instructor_id),
  CONSTRAINT uq_instructors_email UNIQUE (email),
  CONSTRAINT fk_instructors_department FOREIGN KEY (department_id)
    REFERENCES departments (department_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_instructors_first_name CHECK (CHAR_LENGTH(TRIM(first_name)) > 0),
  CONSTRAINT ck_instructors_last_name CHECK (CHAR_LENGTH(TRIM(last_name)) > 0),
  CONSTRAINT ck_instructors_email CHECK (CHAR_LENGTH(TRIM(email)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE terms (
  term_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name ENUM('Spring', 'Summer', 'Fall') NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  PRIMARY KEY (term_id),
  CONSTRAINT uq_terms_name_year UNIQUE (name, year),
  CONSTRAINT ck_terms_year CHECK (year BETWEEN 1900 AND 9999),
  CONSTRAINT ck_terms_dates CHECK (start_date <= end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE courses (
  course_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id INT UNSIGNED NOT NULL,
  course_code VARCHAR(20) NOT NULL,
  title VARCHAR(160) NOT NULL,
  credits TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (course_id),
  CONSTRAINT uq_courses_code UNIQUE (course_code),
  CONSTRAINT fk_courses_department FOREIGN KEY (department_id)
    REFERENCES departments (department_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_courses_code CHECK (CHAR_LENGTH(TRIM(course_code)) > 0),
  CONSTRAINT ck_courses_title CHECK (CHAR_LENGTH(TRIM(title)) > 0),
  CONSTRAINT ck_courses_credits CHECK (credits BETWEEN 1 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sections (
  section_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id INT UNSIGNED NOT NULL,
  instructor_id INT UNSIGNED NOT NULL,
  term_id INT UNSIGNED NOT NULL,
  section_number VARCHAR(12) NOT NULL,
  meeting_time VARCHAR(120) NOT NULL,
  location VARCHAR(120) NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  PRIMARY KEY (section_id),
  CONSTRAINT uq_sections_course_term_number UNIQUE (course_id, term_id, section_number),
  CONSTRAINT fk_sections_course FOREIGN KEY (course_id)
    REFERENCES courses (course_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_sections_instructor FOREIGN KEY (instructor_id)
    REFERENCES instructors (instructor_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_sections_term FOREIGN KEY (term_id)
    REFERENCES terms (term_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_sections_number CHECK (CHAR_LENGTH(TRIM(section_number)) > 0),
  CONSTRAINT ck_sections_meeting_time CHECK (CHAR_LENGTH(TRIM(meeting_time)) > 0),
  CONSTRAINT ck_sections_location CHECK (CHAR_LENGTH(TRIM(location)) > 0),
  CONSTRAINT ck_sections_capacity CHECK (capacity > 0),
  INDEX idx_sections_term_course (term_id, course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE registrations (
  registration_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  section_id INT UNSIGNED NOT NULL,
  registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('ENROLLED', 'COMPLETED', 'DROPPED', 'WITHDRAWN') NOT NULL DEFAULT 'ENROLLED',
  final_grade ENUM('A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F') NULL,
  PRIMARY KEY (registration_id),
  CONSTRAINT uq_registrations_student_section UNIQUE (student_id, section_id),
  CONSTRAINT fk_registrations_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_registrations_section FOREIGN KEY (section_id)
    REFERENCES sections (section_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_registrations_grade_status CHECK (
    (status = 'COMPLETED' AND final_grade IS NOT NULL)
    OR (status IN ('ENROLLED', 'DROPPED', 'WITHDRAWN') AND final_grade IS NULL)
  ),
  INDEX idx_registrations_section_status (section_id, status),
  INDEX idx_registrations_student_status (student_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE course_prerequisites (
  course_id INT UNSIGNED NOT NULL,
  prerequisite_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (course_id, prerequisite_id),
  CONSTRAINT fk_prerequisites_course FOREIGN KEY (course_id)
    REFERENCES courses (course_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_prerequisites_prerequisite FOREIGN KEY (prerequisite_id)
    REFERENCES courses (course_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_prerequisites_no_self CHECK (course_id <> prerequisite_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE waitlist_entries (
  student_id INT UNSIGNED NOT NULL,
  section_id INT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, section_id),
  CONSTRAINT fk_waitlist_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_waitlist_section FOREIGN KEY (section_id)
    REFERENCES sections (section_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  INDEX idx_waitlist_section_queue (section_id, joined_at, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE student_holds (
  hold_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleared_at DATETIME NULL,
  PRIMARY KEY (hold_id),
  CONSTRAINT fk_holds_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_holds_reason CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
  CONSTRAINT ck_holds_dates CHECK (cleared_at IS NULL OR cleared_at >= placed_at),
  INDEX idx_holds_student_active (student_id, cleared_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Cross-row rules (capacity, holds/prerequisite eligibility, prerequisite cycles,
-- waitlist eligibility, and promotion) are checked within application transactions.
-- Names, counts, schedules, and queue positions are not duplicated in other tables.
