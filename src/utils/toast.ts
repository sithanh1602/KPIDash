import { toast } from '@heroui/react';

// Keep existing callers on the official HeroUI v3 toast API.
export const showToast = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  error: (title: string, description?: string) => toast.danger(title, { description }),
  warning: (title: string, description?: string) => toast.warning(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),
};
