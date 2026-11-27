class AppError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') { super(message); this.status = status; this.code = code; }
}
function id(value, label = 'ID') {
  if (!['string','number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 4294967295) throw new AppError(`${label} must be a positive whole number.`);
  return Number(value);
}
function text(value, label, max = 100) {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(`${label} is required.`);
  const result = value.trim();
  if ([...result].length > max) throw new AppError(`${label} must have at most ${max} characters.`);
  return result;
}
function optionalText(value, label, max = 100) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  return text(value, label, max);
}
function person(body) {
  const email = text(body.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email address.');
  return { first_name: text(body.first_name, 'First name', 80), last_name: text(body.last_name, 'Last name', 80), email,
    major: optionalText(body.major, 'Major', 120) };
}
function course(body) {
  const credits = id(body.credits, 'Credits');
  if (credits > 6) throw new AppError('Credits must be between 1 and 6.');
  const code = text(body.course_code, 'Course code', 20).toUpperCase();
  if (!/^[A-Z][A-Z0-9 -]*$/.test(code)) throw new AppError('Course code must start with a letter and contain only letters, digits, spaces, or hyphens.');
  return { department_id: id(body.department_id, 'Department'), course_code: code, title: text(body.title, 'Course title', 160), credits };
}
const grades = ['A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];
function registration(body) {
  if (!['ENROLLED','COMPLETED','DROPPED','WITHDRAWN'].includes(body.status)) throw new AppError('Choose a valid registration status.');
  if (body.final_grade !== undefined && body.final_grade !== null && typeof body.final_grade !== 'string') throw new AppError('Choose a valid final grade.');
  const grade = body.final_grade || null;
  if (body.status === 'COMPLETED' && !grades.includes(grade)) throw new AppError('A completed registration requires a valid final grade.');
  if (body.status !== 'COMPLETED' && grade !== null) throw new AppError('Only completed registrations may have a final grade.');
  return { status: body.status, final_grade: grade };
}
function search(value) {
  if (value === undefined || value === '') return '';
  return text(value, 'Search', 100);
}
function optionalId(value, label) { return value === undefined || value === '' ? null : id(value, label); }
module.exports = { AppError, id, text, optionalText, person, course, registration, search, optionalId, grades };
