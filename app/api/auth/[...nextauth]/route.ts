import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;

// Ensure this route runs in Node.js runtime, not Edge Runtime
export const runtime = 'nodejs';

