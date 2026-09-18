import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../supabaseDb.ts';
import { ROLES } from '../../src/types.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireCoachOrAdmin,
  verifyStudentAccess,
  canAccessStudent
} from '../middleware/auth.ts';
import { paymentRateLimiter } from '../middleware/rateLimiter.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { sendPaginated } from '../pagination.ts';
import { recordAudit } from '../helpers/audit.ts';
import { validate } from '../helpers/validation.ts';
import { getCoachAssignedStudentIds } from '../helpers/coachHelper.ts';
import { ValidationError, AuthorizationError, NotFoundError } from '../errors.ts';
import { createFeeSchema, updateFeeSchema } from '../schemas.ts';

export const feesRouter = Router();

const feeMonthParamsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth parameter must be in YYYY-MM format (e.g. 2026-09)')
});

const feePaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional()
});

const feeStudentIdParamSchema = z.object({
  id: z.string().min(1, 'Student ID parameter is required')
});

const feeIdParamSchema = z.object({
  id: z.string().min(1, 'Fee record ID parameter is required')
});

// GET /api/fees/month/:yearMonth
feesRouter.get('/month/:yearMonth', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeMonthParamsSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid yearMonth parameter.');
  }
  const queryParsed = feePaginationQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { yearMonth } = paramsParsed.data;
  const { page, limit } = queryParsed.data;

  let targetStudentIds: string[] | undefined = undefined;

  // Database-level isolation for coach role:
  if (req.user?.role === ROLES.COACH) {
    targetStudentIds = await getCoachAssignedStudentIds(req.user);

    // If coach has no assigned students, short-circuit immediately without querying fees
    if (targetStudentIds.length === 0) {
      if (page && limit) {
        return res.json({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1
          }
        });
      }
      return res.json([]);
    }
  }

  const queryOptions = {
    ...(page && limit ? { page, limit } : {}),
    ...(targetStudentIds ? { studentIds: targetStudentIds } : {})
  };

  const records = await db.getFeesByMonth(yearMonth, Object.keys(queryOptions).length > 0 ? queryOptions : undefined);

  if (page && limit) {
    const total = await db.getFeesCountByMonth(yearMonth, targetStudentIds);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

// GET /api/fees/student/:id
feesRouter.get('/student/:id', authenticateJwt, verifyStudentAccess('id'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeStudentIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid student ID parameter.');
  }
  const queryParsed = feePaginationQuerySchema.safeParse(req.query);
  if (!queryParsed.success) {
    throw new ValidationError(queryParsed.error.issues[0]?.message || 'Invalid pagination query parameters.');
  }
  const { id } = paramsParsed.data;
  const { page, limit } = queryParsed.data;
  const paginationOptions = (page && limit) ? { page, limit } : undefined;

  const records = await db.getFeesByStudent(id, paginationOptions);

  if (page && limit) {
    const total = await db.getFeesCountByStudent(id);
    return sendPaginated(res, records, total, { page, limit });
  }

  return res.json(records);
}));

// POST /api/fees
feesRouter.post('/', authenticateJwt, paymentRateLimiter, requireCoachOrAdmin, verifyStudentAccess('studentId'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createFeeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid fee record data.');
  }
  const fee = parsed.data;
  const saved = await db.saveFeeRecord(fee as any);

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: fee.studentId,
    action: 'fee_record_create',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} recorded fee of ₹${fee.amount || 0} (${fee.status || 'Pending'}) for student ID: ${fee.studentId} - Ref: ${fee.receiptNumber || 'N/A'}`,
    arguments: { studentId: fee.studentId, amount: fee.amount, status: fee.status, receiptNumber: fee.receiptNumber, milestone: fee.milestone },
    result: { feeId: saved.id, amount: saved.amount, status: saved.status }
  });

  return res.json(saved);
}));

const handleFeeRecordUpdate = async (req: AuthRequest, res: Response, isPatch: boolean) => {
  const { id } = validate(feeIdParamSchema, req.params, 'Invalid fee record ID parameter.');
  const updateData = validate(updateFeeSchema, req.body, 'Invalid fee update data.');

  const existingFee = await db.findFeeById(id);
  if (!existingFee) {
    throw new NotFoundError('Fee record not found');
  }
  if (!await canAccessStudent(req.user, existingFee.studentId)) {
    throw new AuthorizationError('Access denied: You can only update fee records for students assigned to you.');
  }

  // Defensive immutability guard: if client passes a receiptNumber on PATCH, ensure it does not attempt to mutate an existing receiptNumber
  if (isPatch && (updateData as any).receiptNumber !== undefined) {
    const incomingReceipt = (updateData as any).receiptNumber?.trim();
    if (existingFee.receiptNumber && incomingReceipt && incomingReceipt !== existingFee.receiptNumber) {
      throw new ValidationError('receipt_number is immutable and cannot be modified.');
    }
    delete (updateData as any).receiptNumber;
  }

  const updated = await db.updateFeeRecord(id, updateData as any);
  if (!updated) {
    throw new NotFoundError('Fee record not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: updated.studentId,
    action: 'fee_record_update',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} ${isPatch ? 'modified' : 'updated'} fee record #${id} (Status: ${updated.status}, Amount: ₹${updated.amount})`,
    arguments: { feeId: id, updates: updateData },
    result: { feeId: updated.id, status: updated.status, amount: updated.amount }
  });

  return res.json(updated);
};

// PUT /api/fees/:id
feesRouter.put('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  return await handleFeeRecordUpdate(req, res, false);
}));

// PATCH /api/fees/:id
feesRouter.patch('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  return await handleFeeRecordUpdate(req, res, true);
}));

// DELETE /api/fees/:id
feesRouter.delete('/:id', authenticateJwt, requireCoachOrAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const paramsParsed = feeIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    throw new ValidationError(paramsParsed.error.issues[0]?.message || 'Invalid fee record ID parameter.');
  }
  const { id } = paramsParsed.data;
  const existingFee = await db.findFeeById(id);
  if (!existingFee) {
    throw new NotFoundError('Fee record not found');
  }
  if (!await canAccessStudent(req.user, existingFee.studentId)) {
    throw new AuthorizationError('Access denied: You can only delete fee records for students assigned to you.');
  }

  const success = await db.deleteFeeRecord(id);
  if (!success) {
    throw new NotFoundError('Fee record not found');
  }

  recordAudit({
    actorId: req.user?.id,
    actorUsername: req.user?.username,
    actorRole: req.user?.role,
    actorStudentId: existingFee.studentId,
    action: 'fee_record_delete',
    summary: `${req.user?.role === ROLES.COACH ? 'Coach' : 'Administrator'} deleted fee ledger record #${id}`,
    arguments: { feeId: id },
    result: { success: true }
  });

  return res.json({ success: true, message: 'Fee record deleted successfully' });
}));
