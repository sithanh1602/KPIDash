import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Lỗi nghiệp vụ có mã HTTP, message hiển thị thẳng cho người dùng. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message = 'Không tìm thấy dữ liệu.') => new HttpError(404, message);

/** Middleware cuối cùng: đổi mọi lỗi thành JSON { error } */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
    res.status(400).json({ error: `Dữ liệu không hợp lệ${where}: ${issue.message}` });
    return;
  }
  const code = (error as { code?: string }).code;
  if (code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: 'Bản ghi đã tồn tại.' });
    return;
  }
  if ((error as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Không thể xử lý yêu cầu. Kiểm tra kết nối MySQL và thử lại.' });
}
