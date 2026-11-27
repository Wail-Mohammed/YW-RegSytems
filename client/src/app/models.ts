export type View = 'sections' | 'students' | 'courses' | 'registrations' | 'holds' | 'waitlists' | 'reports';
export type Status = 'ENROLLED' | 'COMPLETED' | 'DROPPED' | 'WITHDRAWN';
export interface Department { department_id: number; name: string; }
export interface Term { term_id: number; name: string; year: number; start_date: string; end_date: string; }
export interface Instructor { instructor_id: number; department_id: number; first_name: string; last_name: string; email: string; }
export interface Student { student_id: number; first_name: string; last_name: string; email: string; major: string | null; active_holds?: number; enrollment_count?: number; }
export interface Course { course_id: number; department_id: number; course_code: string; title: string; credits: number; department_name?: string; prerequisite_codes?: string | null; }
export interface Section { section_id: number; course_id: number; instructor_id: number; term_id: number; section_number: string; meeting_time: string; location: string; capacity: number; course_code: string; title: string; credits: number; department_name: string; instructor_name: string; term_name: string; year: number; occupied_seats: number; available_seats: number; waitlist_count: number; }
export interface Registration { registration_id: number; student_id: number; section_id: number; registered_at: string; status: Status; final_grade: string | null; student_name: string; first_name: string; last_name: string; email: string; course_code: string; title: string; credits: number; section_number: string; meeting_time: string; location: string; term_name: string; year: number; instructor_name: string; }
export interface Hold { hold_id: number; student_id: number; student_name: string; reason: string; placed_at: string; cleared_at: string | null; }
export interface Waitlist { student_id: number; section_id: number; student_name: string; course_code: string; title: string; section_number: string; term_name: string; year: number; joined_at: string; position: number; }
export interface EnrollmentReport { section_id: number; course_code: string; title: string; section_number: string; department_name: string; term_name: string; year: number; capacity: number; enrolled_count: number; completed_count: number; occupied_seats: number; available_seats: number; waitlist_count: number; fill_percentage: number; }
export interface Prerequisite { course_id: number; prerequisite_id: number; course_code: string; prerequisite_code: string; }
export interface SectionChoice { section_id: number; term_id: number; section_number: string; course_code: string; title: string; term_name: string; year: number; }
export interface Lookups { departments: Department[]; terms: Term[]; instructors: Instructor[]; courses: Course[]; students: Student[]; sections: SectionChoice[]; }
export interface Stats { students: number; courses: number; sections: number; occupied_seats: number; waitlisted: number; active_holds: number; }
export type DataRow = Section | Student | Course | Registration | Hold | Waitlist | EnrollmentReport;
export interface SelectOption { value: string; label: string; }
export interface FormField { name: string; label: string; type?: 'text' | 'email' | 'number' | 'select'; required?: boolean; maxLength?: number; min?: number; max?: number; wide?: boolean; placeholder?: string; options?: SelectOption[]; }
export interface DialogSpec { title: string; info?: string; fields?: FormField[]; values?: Record<string, string>; submitLabel?: string; details?: Registration[]; detailKind?: 'schedule' | 'roster'; prerequisites?: Prerequisite[]; save?: (values: Record<string, string>) => Promise<string>; }
