import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { IconComponent } from './icon.component';
import { RecordDialogComponent } from './record-dialog.component';
import { Course, DataRow, DialogSpec, EnrollmentReport, FormField, Hold, Lookups, Prerequisite, Registration, Section, SelectOption, Stats, Student, View, Waitlist } from './models';

const EMPTY_LOOKUPS: Lookups = { departments: [], terms: [], instructors: [], courses: [], students: [], sections: [] };
const FILTERS = ['q', 'term_id', 'department_id', 'instructor_id', 'availability', 'status', 'active', 'section_id'];

@Component({ selector: 'app-root', standalone: true, imports: [ReactiveFormsModule, IconComponent, RecordDialogComponent], templateUrl: './app.component.html' })
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly navigation: { id: View; name: string; icon: string }[] = [
    { id: 'sections', name: 'Sections', icon: 'grid' }, { id: 'students', name: 'Students', icon: 'users' },
    { id: 'courses', name: 'Course catalog', icon: 'book' }, { id: 'registrations', name: 'Registrations', icon: 'check' },
    { id: 'holds', name: 'Student holds', icon: 'shield' }, { id: 'waitlists', name: 'Waitlists', icon: 'clock' }, { id: 'reports', name: 'Reports', icon: 'chart' }
  ];
  readonly meta: Record<View, { name: string; description: string; action?: string }> = {
    sections: { name: 'Find Course Sections', description: 'Search course sections and view rosters or available seats.', action: 'New section' },
    students: { name: 'Students', description: 'Add or update student details and view registration history.', action: 'Add student' },
    courses: { name: 'Course catalog', description: 'Add courses, update catalog details, and manage prerequisites.', action: 'Add course' },
    registrations: { name: 'Registrations', description: 'Enroll students, change registration status, and enter grades.', action: 'Enroll a student' },
    holds: { name: 'Student holds', description: 'View, place, or clear student enrollment holds.', action: 'Place a hold' },
    waitlists: { name: 'Waitlists', description: 'View waiting students and promote or remove queue entries.', action: 'Join a waitlist' },
    reports: { name: 'Enrollment reports', description: 'View enrollment totals and available seats by section.' }
  };
  readonly view = signal<View>(this.viewFromHash());
  readonly pageInfo = computed(() => this.meta[this.view()]);
  readonly lookups = signal<Lookups>(EMPTY_LOOKUPS);
  readonly rows = signal<DataRow[]>([]);
  readonly stats = signal<Stats | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly connected = signal(false);
  readonly dialog = signal<DialogSpec | null>(null);
  readonly dialogError = signal('');
  readonly saving = signal(false);
  readonly toasts = signal<{ id: number; message: string; error: boolean }[]>([]);
  readonly appliedFilters = signal<Record<string, string>>({});
  readonly filterForm = new FormRecord<FormControl<string>>(Object.fromEntries(FILTERS.map(key => [key, new FormControl('', { nonNullable: true })])));
  private generation = 0;
  private nextToast = 0;
  readonly statuses = ['ENROLLED', 'COMPLETED', 'DROPPED', 'WITHDRAWN'];
  readonly grades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
  ngOnInit(): void { void this.initialize(); }
  @HostListener('window:hashchange') hashChanged(): void { if (!this.navigation.some(item => item.id === window.location.hash.slice(1))) return; this.view.set(this.viewFromHash()); this.resetFilters(); }
  private viewFromHash(): View {
    const name = window.location.hash.slice(1);
    return ['sections', 'students', 'courses', 'registrations', 'holds', 'waitlists', 'reports'].includes(name) ? name as View : 'sections';
  }
  async initialize(): Promise<void> {
    this.error.set('');
    try { await this.refreshLookups(); await this.loadView(); }
    catch (error) { this.connected.set(false); this.error.set(this.message(error)); }
  }
  private async refreshLookups(): Promise<void> { this.lookups.set(await this.api.get<Lookups>('/lookups')); this.connected.set(true); }
  async loadView(): Promise<void> {
    const generation = ++this.generation, view = this.view();
    this.loading.set(true); this.error.set(''); document.title = `Campus Register · ${this.meta[view].name}`;
    try {
      const filters = this.appliedFilters();
      const [rows, dashboard] = await Promise.all([
        this.api.get<DataRow[]>(view === 'reports' ? '/reports/enrollment' : '/' + view, filters),
        view === 'sections' ? this.api.get<{ stats: Stats }>('/dashboard', { term_id: filters['term_id'] || '' }) : Promise.resolve(null)
      ]);
      if (generation !== this.generation) return;
      this.rows.set(rows); this.stats.set(dashboard?.stats || null); this.connected.set(true);
    } catch (error) { if (generation === this.generation) { this.error.set(this.message(error)); this.connected.set(false); } }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  applyFilters(): void { this.appliedFilters.set(this.filterForm.getRawValue()); void this.loadView(); }
  resetFilters(): void { this.filterForm.reset(Object.fromEntries(FILTERS.map(key => [key, '']))); this.appliedFilters.set({}); void this.loadView(); }
  selectedTerm(): string { const term = this.lookups().terms.find(t => String(t.term_id) === this.appliedFilters()['term_id']); return term ? `${term.name} ${term.year}` : 'All academic terms'; }
  sections(): Section[] { return this.rows() as Section[]; }
  students(): Student[] { return this.rows() as Student[]; }
  courses(): Course[] { return this.rows() as Course[]; }
  registrations(): Registration[] { return this.rows() as Registration[]; }
  holds(): Hold[] { return this.rows() as Hold[]; }
  waitlists(): Waitlist[] { return this.rows() as Waitlist[]; }
  reports(): EnrollmentReport[] { return this.rows() as EnrollmentReport[]; }
  label(value: string): string { return value ? value[0] + value.slice(1).toLowerCase().replaceAll('_', ' ') : ''; }
  pillClass(status: string): string { return ({ ENROLLED: 'green', COMPLETED: 'teal', DROPPED: 'gray', WITHDRAWN: 'orange' } as Record<string, string>)[status] || 'gray'; }
  seatPercentage(row: Section): number { return Math.min(100, Math.max(0, row.occupied_seats / row.capacity * 100)); }
  formatDate(value: string | null): string { return value || '—'; }
  private options<T>(rows: T[], value: (row: T) => string | number, label: (row: T) => string, placeholder: string): SelectOption[] { return [{ value: '', label: placeholder }, ...rows.map(row => ({ value: String(value(row)), label: label(row) }))]; }
  private select(name: string, label: string, options: SelectOption[], required = true, wide = false): FormField { return { name, label, type: 'select', options, required, wide }; }
  private values(row?: object): Record<string, string> { return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, value == null ? '' : String(value)])); }
  private departmentOptions(): SelectOption[] { return this.options(this.lookups().departments, d => d.department_id, d => d.name, 'Choose a department'); }
  private studentOptions(): SelectOption[] { return this.options(this.lookups().students, s => s.student_id, s => `${s.first_name} ${s.last_name} · #${s.student_id}`, 'Choose a student'); }
  private sectionOptions(): SelectOption[] { return this.options(this.lookups().sections, s => s.section_id, s => `${s.course_code} · ${s.section_number} · ${s.term_name} ${s.year}`, 'Choose a section'); }
  private open(spec: DialogSpec): void { this.dialogError.set(''); this.dialog.set(spec); }
  closeDialog(): void { if (!this.saving()) this.dialog.set(null); }
  actionId(): string { return ({sections:'new-section', students:'new-student', courses:'new-course', registrations:'enroll', holds:'new-hold', waitlists:'join-waitlist', reports:''})[this.view()]; }
  panelTitle(): string { return ({sections:'Course offerings', students:'Student directory', courses:'Catalog courses', registrations:'Registration records', holds:'Student holds', waitlists:'Section waitlists', reports:'Enrollment & seat availability'})[this.view()]; }
  newRecord(): void {
    switch (this.view()) {
      case 'sections': this.sectionDialog(); break;
      case 'students': this.studentDialog(); break;
      case 'courses': this.courseDialog(); break;
      case 'registrations': this.enrollmentDialog(); break;
      case 'holds': this.holdDialog(); break;
      case 'waitlists': this.enrollmentDialog('', true); break;
      default: break;
    }
  }
  studentDialog(row?: Student): void {
    this.open({ title: row ? 'Edit student' : 'Add a student', values: this.values(row), submitLabel: row ? 'Save student' : 'Add student', fields: [
      { name: 'first_name', label: 'First name', maxLength: 80 }, { name: 'last_name', label: 'Last name', maxLength: 80 },
      { name: 'email', label: 'Email', type: 'email', maxLength: 254, wide: true },
      { name: 'major', label: 'Major (optional)', maxLength: 120, required: false, placeholder: 'Undeclared if left blank', wide: true }
    ], save: async values => { await this.api.write(row ? 'PUT' : 'POST', row ? `/students/${row.student_id}` : '/students', values); return row ? 'Student updated.' : 'Student added.'; } });
  }
  courseDialog(row?: Course): void {
    this.open({ title: row ? 'Edit course' : 'Add a course', values: this.values(row), submitLabel: row ? 'Save course' : 'Add course', fields: [
      { name: 'course_code', label: 'Course code', maxLength: 20, placeholder: 'CS 101' }, this.select('department_id', 'Department', this.departmentOptions()),
      { name: 'title', label: 'Course title', maxLength: 160, wide: true }, { name: 'credits', label: 'Credits', type: 'number', min: 1, max: 6 }
    ], save: async values => { await this.api.write(row ? 'PUT' : 'POST', row ? `/courses/${row.course_id}` : '/courses', { ...values, department_id: Number(values['department_id']), credits: Number(values['credits']) }); return row ? 'Course updated.' : 'Course added.'; } });
  }
  sectionDialog(row?: Section): void {
    const lookups = this.lookups();
    this.open({ title: row ? 'Edit section' : 'Add a section', values: this.values(row), submitLabel: row ? 'Save section' : 'Add section', fields: [
      this.select('course_id', 'Course', this.options(lookups.courses, c => c.course_id, c => `${c.course_code} · ${c.title}`, 'Choose a course'), true, true),
      this.select('instructor_id', 'Instructor', this.options(lookups.instructors, i => i.instructor_id, i => `${i.first_name} ${i.last_name}`, 'Choose an instructor')),
      this.select('term_id', 'Term', this.options(lookups.terms, t => t.term_id, t => `${t.name} ${t.year}`, 'Choose a term')),
      { name: 'section_number', label: 'Section number', maxLength: 12 }, { name: 'capacity', label: 'Capacity', type: 'number', min: 1, max: 4294967295 },
      { name: 'meeting_time', label: 'Meeting time', maxLength: 120, wide: true }, { name: 'location', label: 'Location', maxLength: 120, wide: true }
    ], save: async values => { const body: Record<string, string | number> = { ...values }; for (const key of ['course_id', 'instructor_id', 'term_id', 'capacity']) body[key] = Number(values[key]); await this.api.write(row ? 'PUT' : 'POST', row ? `/sections/${row.section_id}` : '/sections', body); return row ? 'Section updated.' : 'Section added.'; } });
  }
  enrollmentDialog(sectionId: number | string = '', waitlist = false): void {
    this.open({ title: waitlist ? 'Join a waitlist' : 'Enroll a student', info: waitlist ? 'A section must be full, and the student must not already occupy a seat.' : 'Enrollment checks active holds, prerequisites, duplicate registrations, available seats, and waitlist order.', values: { section_id: String(sectionId) }, fields: [this.select('student_id', 'Student', this.studentOptions(), true, true), this.select('section_id', 'Section', this.sectionOptions(), true, true)], submitLabel: waitlist ? 'Join waitlist' : 'Enroll student', save: async values => { await this.api.write('POST', waitlist ? '/waitlists' : '/registrations', { student_id: Number(values['student_id']), section_id: Number(values['section_id']) }); return waitlist ? 'Student added to the waitlist.' : 'Student enrolled.'; } });
  }
  registrationDialog(row: Registration): void {
    this.open({ title: 'Update registration', info: `${row.student_name}\n${row.course_code} · ${row.section_number}\nRegistration #${row.registration_id}. A final grade is required only for COMPLETED status.`, values: this.values(row), fields: [this.select('status', 'Status', this.options(this.statuses, s => s, s => this.label(s), 'Choose a status')), this.select('final_grade', 'Final grade', this.options(this.grades, g => g, g => g, 'Choose a grade'), false)], submitLabel: 'Save registration', save: async values => { await this.api.write('PUT', `/registrations/${row.registration_id}`, { status: values['status'], final_grade: values['status'] === 'COMPLETED' ? values['final_grade'] : null }); return 'Registration updated.'; } });
  }
  holdDialog(): void {
    this.open({ title: 'Place a student hold', info: 'An active hold blocks new enrollment. Existing registrations remain recorded.', fields: [this.select('student_id', 'Student', this.studentOptions(), true, true), { name: 'reason', label: 'Reason', maxLength: 255, wide: true }], submitLabel: 'Place hold', save: async values => { await this.api.write('POST', '/holds', { student_id: Number(values['student_id']), reason: values['reason'] }); return 'Student hold placed.'; } });
  }
  async schedule(student: Student): Promise<void> {
    try { const details = await this.api.get<Registration[]>(`/students/${student.student_id}/schedule`); this.open({ title: `${student.first_name} ${student.last_name}`, info: `Registration history · Student #${student.student_id}`, details, detailKind: 'schedule' }); }
    catch (error) { this.notify(this.message(error), true); }
  }
  async roster(section: Section): Promise<void> {
    try { const details = await this.api.get<Registration[]>(`/sections/${section.section_id}/roster`); this.open({ title: `${section.course_code} · Section ${section.section_number}`, info: section.title, details, detailKind: 'roster' }); }
    catch (error) { this.notify(this.message(error), true); }
  }
  async prerequisites(course: Course): Promise<void> {
    try { const prerequisites = await this.api.get<Prerequisite[]>('/prerequisites', { course_id: String(course.course_id) }); this.open({ title: `Prerequisites · ${course.course_code}`, info: 'A course cannot require itself or form a cycle. Under this design, the listed non-F grades satisfy prerequisites.', prerequisites, fields: [this.select('prerequisite_id', 'Add prerequisite', this.options(this.lookups().courses.filter(c => c.course_id !== course.course_id), c => c.course_id, c => `${c.course_code} · ${c.title}`, 'Choose a course'), true, true)], submitLabel: 'Add prerequisite', save: async values => { await this.api.write('POST', '/prerequisites', { course_id: course.course_id, prerequisite_id: Number(values['prerequisite_id']) }); return 'Prerequisite added.'; } }); }
    catch (error) { this.notify(this.message(error), true); }
  }
  async removePrerequisite(link: Prerequisite): Promise<void> {
    this.saving.set(true); this.dialogError.set('');
    try {
      await this.api.write('DELETE', `/prerequisites?course_id=${link.course_id}&prerequisite_id=${link.prerequisite_id}`);
      this.dialog.set(null); this.notify('Prerequisite removed.'); await this.afterSave();
    } catch (error) { this.dialogError.set(this.message(error)); }
    finally { this.saving.set(false); }
  }
  setHold(row: Hold): void {
    const cleared = !row.cleared_at;
    this.confirm(cleared ? 'Clear this hold?' : 'Reactivate this hold?', cleared ? 'Other active holds and prerequisites still apply.' : 'This hold will block new enrollment until cleared.', async () => { await this.api.write('PUT', `/holds/${row.hold_id}`, { cleared }); return cleared ? 'Hold cleared.' : 'Hold reactivated.'; }, cleared ? 'Clear hold' : 'Reactivate hold');
  }
  promote(row: Waitlist): void { this.confirm('Promote from waitlist?', 'The student must be first in line, a seat must be open, and the enrollment requirements must still be satisfied.', async () => { await this.api.write('POST', '/waitlists/promote', { student_id: row.student_id, section_id: row.section_id }); return 'Student promoted and enrolled.'; }, 'Promote student'); }
  removeWaitlist(row: Waitlist): void { this.confirm('Remove this waitlist entry?', 'Remove this active queue entry. Existing registration history remains recorded.', async () => { await this.api.write('DELETE', `/waitlists/${row.student_id}/${row.section_id}`); return 'Waitlist entry removed.'; }, 'Remove entry'); }
  private confirm(title: string, info: string, task: () => Promise<string>, submitLabel: string): void { this.open({ title, info, submitLabel, save: task }); }
  async saveDialog(values: Record<string, string>): Promise<void> {
    const spec = this.dialog(); if (!spec?.save || this.saving()) return;
    this.saving.set(true); this.dialogError.set('');
    try { const message = await spec.save(values); this.dialog.set(null); this.notify(message); await this.afterSave(); }
    catch (error) { this.dialogError.set(this.message(error)); }
    finally { this.saving.set(false); }
  }
  private async afterSave(): Promise<void> { try { await this.refreshLookups(); await this.loadView(); } catch (error) { this.notify(`Your change was saved, but the display could not refresh: ${this.message(error)}`, true); } }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'The operation could not be completed.'; }
  private notify(message: string, error = false): void { const id = ++this.nextToast; this.toasts.update(items => [...items, { id, message, error }]); setTimeout(() => this.toasts.update(items => items.filter(item => item.id !== id)), 6500); }
}
