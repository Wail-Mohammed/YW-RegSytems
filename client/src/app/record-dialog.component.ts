import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, inject, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DialogSpec, FormField, Prerequisite, Registration } from './models';

@Component({
  selector: 'app-record-dialog', standalone: true, imports: [ReactiveFormsModule],
  templateUrl: './record-dialog.component.html'
})
export class RecordDialogComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) spec!: DialogSpec;
  @Input() saving = false;
  @Input() error = '';
  @Output() submitted = new EventEmitter<Record<string, string>>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() editRegistration = new EventEmitter<Registration>();
  @Output() removePrerequisite = new EventEmitter<Prerequisite>();
  @ViewChild('nativeDialog', { static: true }) nativeDialog!: ElementRef<HTMLDialogElement>;
  form = new FormRecord<FormControl<string>>({});
  attempted = false;
  private subscription?: Subscription;
  private readonly changeDetector = inject(ChangeDetectorRef);
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['spec']) return;
    this.subscription?.unsubscribe();
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.spec.fields || []) {
      const validators = [];
      if (field.required !== false) validators.push(Validators.required);
      if (field.type === 'email') validators.push(Validators.email);
      if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
      if (field.min !== undefined) validators.push(Validators.min(field.min));
      if (field.max !== undefined) validators.push(Validators.max(field.max));
      controls[field.name] = new FormControl(this.spec.values?.[field.name] || '', { nonNullable: true, validators });
    }
    this.form = new FormRecord(controls);
    this.attempted = false;
    if (controls['status'] && controls['final_grade']) {
      this.subscription = controls['status'].valueChanges.subscribe(() => { this.syncGrade(); this.changeDetector.markForCheck(); });
      this.syncGrade();
    }
  }
  ngAfterViewInit(): void { this.nativeDialog.nativeElement.showModal(); }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
  required(field: FormField): boolean { return field.name === 'final_grade' ? this.form.controls['status']?.value === 'COMPLETED' : field.required !== false; }
  invalid(name: string): boolean { const c = this.form.controls[name]; return !!c && c.invalid && (c.touched || this.attempted); }
  private syncGrade(): void {
    const grade = this.form.controls['final_grade'];
    if (this.form.controls['status'].value === 'COMPLETED') { grade.enable(); grade.setValidators(Validators.required); }
    else { grade.clearValidators(); grade.setValue(''); grade.disable(); }
    grade.updateValueAndValidity();
  }
  submit(): void {
    if (this.saving || !this.spec.save) return;
    this.attempted = true; this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.submitted.emit(this.form.getRawValue());
  }
  cancel(event?: Event): void { event?.preventDefault(); if (!this.saving) this.cancelled.emit(); }
}
