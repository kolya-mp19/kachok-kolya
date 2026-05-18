import { z } from 'zod';

export const genderSchema = z.enum(['male', 'female']);

export const registerBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').transform((s) => s.trim()),
  gender: genderSchema.optional(),
});

export const loginBodySchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileBodySchema = z.object({
  name: z.string().min(1, 'Имя не может быть пустым').transform((s) => s.trim()),
  gender: genderSchema.nullable().optional(),
  password: z.string().min(8, 'Пароль должен содержать не менее 8 символов').optional(),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => {
    if (data.password !== undefined || data.confirmPassword !== undefined) {
      return data.password === data.confirmPassword;
    }
    return true;
  },
  { message: 'Пароли не совпадают', path: ['confirmPassword'] },
);

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
