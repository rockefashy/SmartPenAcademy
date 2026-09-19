import { z } from 'zod';

export interface EnrollmentFormData {
  firstName: string;
  lastName?: string;
  age: string | number;
  parentName: string;
  whatsappMobile: string;
  email: string;
  password?: string;
  isEditMode?: boolean;
  isSiblingEnrollment?: boolean;
  selectedDays: string[];
  preferredSlot: string;
  classesPerCycle: string | number;
  feePerCycle: string | number;
  scriptsRequired: string[];
  academicModules: string[];
  diagnosticObservations: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  elementId?: string;
}

export function validateEnrollmentForm(data: EnrollmentFormData): ValidationResult {
  if (!data.firstName?.trim()) {
    return {
      isValid: false,
      error: "Student's First Name is required.",
      elementId: 'input-student-firstname',
    };
  }

  const numAge = Number(data.age);
  if (!data.age || isNaN(numAge) || numAge < 4 || numAge > 18) {
    return {
      isValid: false,
      error: 'Student age must be a valid number between 4 and 18.',
      elementId: 'input-student-age',
    };
  }

  if (!data.parentName?.trim()) {
    return {
      isValid: false,
      error: 'Parent / Guardian name is required.',
      elementId: 'input-parent-name',
    };
  }

  const cleanPhone = (data.whatsappMobile || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      isValid: false,
      error: 'A valid 10-digit WhatsApp phone number is required.',
      elementId: 'input-whatsapp-mobile',
    };
  }

  const cleanEmail = (data.email || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@') || !z.string().email().safeParse(cleanEmail).success) {
    return {
      isValid: false,
      error: 'A valid parent email address is required.',
      elementId: 'input-parent-email',
    };
  }

  if (!data.isEditMode && !data.isSiblingEnrollment && (!data.password || data.password.length < 8)) {
    return {
      isValid: false,
      error: 'A secure password of at least 8 characters is required.',
      elementId: 'input-parent-password',
    };
  }

  if (data.isEditMode && data.password && data.password.length < 8) {
    return {
      isValid: false,
      error: 'New password must be at least 8 characters long.',
      elementId: 'input-parent-password',
    };
  }

  if (!data.selectedDays || data.selectedDays.length < 1) {
    return {
      isValid: false,
      error: 'Please select at least one preferred weekly class day.',
      elementId: 'section-4-preferred-schedule',
    };
  }

  if (!data.preferredSlot) {
    return {
      isValid: false,
      error: 'Please select a preferred daily time slot.',
      elementId: 'select-preferred-slot',
    };
  }

  const numClasses = Number(data.classesPerCycle);
  if (!data.classesPerCycle || isNaN(numClasses) || numClasses < 1) {
    return {
      isValid: false,
      error: 'Classes per cycle must be at least 1.',
      elementId: 'input-classes-per-cycle',
    };
  }

  const numFee = Number(data.feePerCycle);
  if (data.feePerCycle === '' || isNaN(numFee) || numFee < 0) {
    return {
      isValid: false,
      error: 'Fee per cycle must be a non-negative amount.',
      elementId: 'input-fee-per-cycle',
    };
  }

  if (!data.scriptsRequired || data.scriptsRequired.length === 0) {
    return {
      isValid: false,
      error: 'Please select at least one handwriting script required.',
      elementId: 'section-3-programs-modules',
    };
  }

  if (!data.academicModules || data.academicModules.length === 0) {
    return {
      isValid: false,
      error: 'Please select at least one core academic focus module.',
      elementId: 'section-3-programs-modules',
    };
  }

  if (!data.diagnosticObservations || data.diagnosticObservations.length === 0) {
    return {
      isValid: false,
      error: 'Please select at least one diagnostic observation or area of concern.',
      elementId: 'section-5-areas-of-concern',
    };
  }

  return { isValid: true };
}
