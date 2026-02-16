/**
 * Input Validation Schemas using Zod
 * 
 * All API inputs are validated against these schemas
 * before being processed by the service.
 */

const { z } = require('zod');

// ISO 8601 datetime string validation
const isoDateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid ISO 8601 datetime format' }
).transform((val) => new Date(val));

// User schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  timezone: z.string().default('UTC'),
});

// Create booking schema
const CreateBookingSchema = z.object({
  userId: z.string().optional().nullable(), // Optional for demo
  startTime: isoDateTimeSchema.refine(
    (val) => val > new Date(),
    { message: 'Start time must be in the future' }
  ),
  endTime: isoDateTimeSchema,
  status: z.enum(['PENDING', 'CONFIRMED']).optional(),
  metadata: z.object({
    title: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    meetingUrl: z.string().url().optional(),
  }).optional(),
});

// Validate end time is after start time
const CreateBookingWithTimeValidation = CreateBookingSchema.refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

// Update booking schema (partial)
const UpdateBookingSchema = CreateBookingSchema.partial();

// Cancel booking schema
const CancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Reschedule booking schema
const RescheduleBookingSchema = z.object({
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema,
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

// Get available slots schema
const GetSlotsSchema = z.object({
  userId: z.string().uuid(),
  startDate: isoDateTimeSchema,
  endDate: isoDateTimeSchema,
  slotDuration: z.number().int().positive().default(30), // minutes
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

// Pagination schema
const PaginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Query params schema for listing bookings
const ListBookingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
  startDate: isoDateTimeSchema.optional(),
  endDate: isoDateTimeSchema.optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

module.exports = {
  UserSchema,
  CreateBookingSchema,
  CreateBookingWithTimeValidation,
  UpdateBookingSchema,
  CancelBookingSchema,
  RescheduleBookingSchema,
  GetSlotsSchema,
  PaginationSchema,
  ListBookingsQuerySchema,
};
