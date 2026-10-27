import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import { pool } from './config/db';
import { login } from './modules/auth/auth.service';
import { createWeek, deleteWeek, getWeekMembers, loadRawWeek, setWeekMembers } from './modules/weeks/weeks.repository';
import { loadSheet, saveSheet } from './modules/sheets/sheet-store';
import { buildReport } from '../shared/kpi';
import { weeksRouter } from './modules/weeks/weeks.routes';
import { errorHandler } from './middleware/errors';
import { ACCESS_AUDIENCE, TOKEN_ISSUER } from './middleware/auth';

import { redis } from './config/redis';

test.after(async () => {
  redis?.disconnect();
  await pool.end();
});

test('auth service logins leader with valid credentials from .env', async () => {
  const session = await login(env.admin.email, env.admin.password);
  assert.equal(session.user.email, env.admin.email);
  assert.equal(session.user.role, 'leader');
  assert.ok(session.accessToken.length > 20);
});

test('real business workflow: create week, assign member, save daily production and verify report calculations', async () => {
  const session = await login(env.admin.email, env.admin.password);
  const userId = session.user.id;

  // 1. Tạo 2 thành viên kiểm thử
  const [res1] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO members (name, role) VALUES (?, ?)',
    ['Annotator Test A', 'Annotator'],
  );
  const [res2] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO members (name, role) VALUES (?, ?)',
    ['Annotator Test B', 'Annotator'],
  );
  const m1Id = res1.insertId;
  const m2Id = res2.insertId;

  // 2. Tạo tuần kiểm thử
  const testStartDate = '2026-11-02';
  const testEndDate = '2026-11-07';
  const week = await createWeek({ weekNumber: 45, startDate: testStartDate, endDate: testEndDate }, userId);
  assert.equal(week.weekNumber, 45);
  assert.equal(week.startDate, testStartDate);
  assert.equal(week.endDate, testEndDate);

  try {
    // 3. Phân bổ thành viên vào tuần
    await setWeekMembers(week.id, [m1Id, m2Id]);
    const weekMembers = await getWeekMembers(pool, week.id);
    assert.equal(weekMembers.length, 2);

    // 4. Lưu bảng sản lượng ngày:
    // Member 1: T2=1200, T3=1500, T4=Nghỉ, T5=Done job, T6=1400, T7=Nghỉ -> Tổng: 4100, Ngày công: 3, TB: 1367 (Xuất sắc >= 1200)
    // Member 2: T2=900, T3=900, T4=0, T5=950, T6=Nghỉ, T7=Done job -> Tổng: 2750, Ngày công: 4 (ô 0 tính công), TB: 688 (Dưới KPI < 1000)
    await saveSheet(
      week.id,
      'production',
      [
        {
          memberId: m1Id,
          values: {
            member: 'Annotator Test A',
            d0: '1200',
            d1: '1500',
            d2: 'Nghỉ',
            d3: 'Done job',
            d4: '1400',
            d5: 'Nghỉ',
            todayNote: 'Xong sớm',
          },
        },
        {
          memberId: m2Id,
          values: {
            member: 'Annotator Test B',
            d0: '900',
            d1: '900',
            d2: '0',
            d3: '950',
            d4: 'Nghỉ',
            d5: 'Done job',
            todayNote: '',
          },
        },
      ],
      userId,
    );

    // 5. Nạp và tính toán báo cáo
    const raw = await loadRawWeek(pool, week.id);
    const report = buildReport(raw);

    // Kiểm tra tính toán của Member 1
    const repM1 = report.members.find((m) => m.id === m1Id)!;
    assert.equal(repM1.total, 4100);
    assert.equal(repM1.workDays, 3, 'Nghỉ và Done job không tính vào ngày công');
    assert.equal(repM1.avg, Math.round(4100 / 3)); // 1367
    assert.equal(repM1.grade, 'excellent');
    assert.equal(repM1.kpiPercent, Math.round((1367 / week.target) * 100));

    // Kiểm tra tính toán của Member 2
    const repM2 = report.members.find((m) => m.id === m2Id)!;
    assert.equal(repM2.total, 2750);
    assert.equal(repM2.workDays, 4, 'Ô số 0 vẫn tính 1 ngày công');
    assert.equal(repM2.avg, Math.round(2750 / 4)); // 688
    assert.equal(repM2.grade, 'below');

    // Kiểm tra tổng quan toàn đội
    assert.equal(report.summary.total, 4100 + 2750);
    assert.equal(report.summary.workDays, 3 + 4);
    assert.equal(report.summary.teamAvg, Math.round(6850 / 7));
    assert.equal(report.ranking[0].id, m1Id, 'M1 có TB cao hơn phải đứng đầu bảng xếp hạng');
    assert.equal(report.ranking[1].id, m2Id);
  } finally {
    // 6. Xóa dữ liệu kiểm thử, giữ DB sạch
    await deleteWeek(week.id);
    await pool.execute('DELETE FROM members WHERE id IN (?, ?)', [m1Id, m2Id]);
  }
});

test('parseToolQaBuffer parses Datumaro QA report thinhnv.xlsx accurately', async () => {
  const fs = await import('node:fs/promises');
  const path = '/home/thanh/Downloads/thinhnv/annotations/thinhnv.xlsx';
  try {
    const buffer = await fs.readFile(path);
    const { parseToolQaBuffer } = await import('./modules/imports/tool-qa-parser');
    const result = await parseToolQaBuffer(buffer);

    assert.equal(result.cuboids, 2516);
    assert.equal(result.s, 63);
    assert.equal(result.k, 486);
    assert.equal(result.z, 1);
    assert.equal(result.h, 16);
    assert.equal(result.o, 200);
    assert.equal(result.d, 21);
    assert.equal(result.totalWarnings, 787);
    assert.ok(result.highRiskTracks.length > 0);
    assert.ok(result.suggestedCoaching.commonErrors.includes('Kích thước ngoài ngưỡng'));
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // Bỏ qua nếu file không tồn tại trong môi trường CI
      return;
    }
    throw err;
  }
});

test('role permissions: QC and Annotator strict authorization checks', async () => {
  // 1. Khởi tạo Express app kiểm thử
  const app = express();
  app.use(express.json());
  app.use('/api/weeks', weeksRouter);
  app.use(errorHandler);

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api/weeks`;

  // 2. Lấy session Leader
  const leaderSession = await login(env.admin.email, env.admin.password);
  const leaderToken = leaderSession.accessToken;

  // 3. Tạo Member và User cho QC và Annotator
  const [mQcRes] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO members (name, role) VALUES (?, ?)',
    ['Test QC Member', 'QC'],
  );
  const [mAnnoRes] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO members (name, role) VALUES (?, ?)',
    ['Test Anno Member', 'Annotator'],
  );
  const [mVictimRes] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO members (name, role) VALUES (?, ?)',
    ['Test Victim Member', 'Annotator'],
  );

  const qcMemberId = mQcRes.insertId;
  const annoMemberId = mAnnoRes.insertId;
  const victimMemberId = mVictimRes.insertId;

  const [uQcRes] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)',
    ['Test QC Member', 'test_qc@anno.local', 'fake_hash', 'qc'],
  );
  const [uAnnoRes] = await pool.execute<import('./config/db').ResultSetHeader>(
    'INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)',
    ['Test Anno Member', 'test_anno@anno.local', 'fake_hash', 'annotator'],
  );

  const qcUserId = uQcRes.insertId;
  const annoUserId = uAnnoRes.insertId;

  const qcToken = jwt.sign({ id: qcUserId, role: 'qc' }, env.jwt.accessSecret, {
    expiresIn: '15m',
    issuer: TOKEN_ISSUER,
    audience: ACCESS_AUDIENCE,
  });
  const annoToken = jwt.sign({ id: annoUserId, role: 'annotator' }, env.jwt.accessSecret, {
    expiresIn: '15m',
    issuer: TOKEN_ISSUER,
    audience: ACCESS_AUDIENCE,
  });

  // 4. Tạo tuần kiểm thử bằng quyền Leader
  const testStartDate = '2026-11-09';
  const testEndDate = '2026-11-14';
  const week = await createWeek({ weekNumber: 46, startDate: testStartDate, endDate: testEndDate }, leaderSession.user.id);

  try {
    await setWeekMembers(week.id, [qcMemberId, annoMemberId, victimMemberId]);

    // Initial production data do Leader tạo
    await saveSheet(
      week.id,
      'production',
      [
        { memberId: annoMemberId, values: { member: 'Test Anno Member', d0: '1000' } },
        { memberId: victimMemberId, values: { member: 'Test Victim Member', d0: '2000' } },
        { memberId: qcMemberId, values: { member: 'Test QC Member', d0: '1500' } },
      ],
      leaderSession.user.id,
    );

    // --- KIỂM THỬ 1: Annotator và QC KHÔNG ĐƯỢC tạo tuần mới (403) ---
    const annoCreateRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${annoToken}` },
      body: JSON.stringify({ weekNumber: 99, startDate: '2026-12-01', endDate: '2026-12-06' }),
    });
    assert.equal(annoCreateRes.status, 403, 'Annotator không có quyền tạo tuần');

    const qcCreateRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qcToken}` },
      body: JSON.stringify({ weekNumber: 99, startDate: '2026-12-01', endDate: '2026-12-06' }),
    });
    assert.equal(qcCreateRes.status, 403, 'QC không có quyền tạo tuần');

    // --- KIỂM THỬ 2: Annotator và QC KHÔNG ĐƯỢC xóa tuần (403) ---
    const annoDeleteRes = await fetch(`${baseUrl}/${week.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${annoToken}` },
    });
    assert.equal(annoDeleteRes.status, 403, 'Annotator không có quyền xóa tuần');

    const qcDeleteRes = await fetch(`${baseUrl}/${week.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${qcToken}` },
    });
    assert.equal(qcDeleteRes.status, 403, 'QC không có quyền xóa tuần');

    // --- KIỂM THỬ 3: Chỉ Leader được sửa bảng Attitude (QC và Annotator nhận 403) ---
    const annoAttitudeRes = await fetch(`${baseUrl}/${week.id}/sheets/attitude`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${annoToken}` },
      body: JSON.stringify({ rows: [{ memberId: annoMemberId, values: { score: '5' } }] }),
    });
    assert.equal(annoAttitudeRes.status, 403, 'Annotator bị cấm sửa Attitude');

    const qcAttitudeRes = await fetch(`${baseUrl}/${week.id}/sheets/attitude`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qcToken}` },
      body: JSON.stringify({ rows: [{ memberId: qcMemberId, values: { score: '5' } }] }),
    });
    assert.equal(qcAttitudeRes.status, 403, 'QC bị cấm sửa Attitude (chỉ Leader)');

    // --- KIỂM THỬ 4: QC được sửa Manual QA, Annotator bị cấm (403) ---
    const annoManualQaRes = await fetch(`${baseUrl}/${week.id}/sheets/manual_qa`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${annoToken}` },
      body: JSON.stringify({ rows: [{ memberId: annoMemberId, values: { floatingBox: '2' } }] }),
    });
    assert.equal(annoManualQaRes.status, 403, 'Annotator bị cấm sửa Manual QA');

    const qcManualQaRes = await fetch(`${baseUrl}/${week.id}/sheets/manual_qa`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qcToken}` },
      body: JSON.stringify({ rows: [{ memberId: annoMemberId, values: { floatingBox: '2' } }] }),
    });
    assert.equal(qcManualQaRes.status, 200, 'QC có quyền cập nhật Manual QA');

    // --- KIỂM THỬ 5: Annotator chỉ được sửa dòng sản lượng của chính mình, KHÔNG thể sửa của người khác ---
    // Annotator gửi payload sửa chính mình thành 1300 VÀ cố ý hạ điểm Victim thành 100
    const annoProdRes = await fetch(`${baseUrl}/${week.id}/sheets/production`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${annoToken}` },
      body: JSON.stringify({
        rows: [
          { memberId: annoMemberId, values: { member: 'Test Anno Member', d0: '1300' } },
          { memberId: victimMemberId, values: { member: 'Test Victim Member', d0: '100' } },
        ],
      }),
    });
    assert.equal(annoProdRes.status, 200);

    // Kiểm tra DB: Victim vẫn giữ nguyên 2000, Anno đã cập nhật lên 1300
    const afterProdRows = await loadSheet(pool, week.id, 'production');
    const savedAnno = afterProdRows.find((r) => r.memberId === annoMemberId);
    const savedVictim = afterProdRows.find((r) => r.memberId === victimMemberId);
    assert.equal(savedAnno?.values.d0, '1300', 'Dòng của Annotator được cập nhật đúng');
    assert.equal(savedVictim?.values.d0, '2000', 'Dòng của người khác KHÔNG bị Annotator ghi đè');

    // --- KIỂM THỬ 6: QC cũng phải hoàn thành KPI nhưng chỉ được sửa sản lượng của chính mình ---
    const qcProdRes = await fetch(`${baseUrl}/${week.id}/sheets/production`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${qcToken}` },
      body: JSON.stringify({
        rows: [
          { memberId: qcMemberId, values: { member: 'Test QC Member', d0: '1800' } },
          { memberId: victimMemberId, values: { member: 'Test Victim Member', d0: '500' } },
        ],
      }),
    });
    assert.equal(qcProdRes.status, 200);

    const afterQcProdRows = await loadSheet(pool, week.id, 'production');
    const savedQc = afterQcProdRows.find((r) => r.memberId === qcMemberId);
    const savedVictimAfterQc = afterQcProdRows.find((r) => r.memberId === victimMemberId);
    assert.equal(savedQc?.values.d0, '1800', 'Dòng của QC được cập nhật đúng');
    assert.equal(savedVictimAfterQc?.values.d0, '2000', 'Dòng của người khác KHÔNG bị QC ghi đè');
  } finally {
    server.close();
    await deleteWeek(week.id);
    await pool.execute('DELETE FROM users WHERE id IN (?, ?)', [qcUserId, annoUserId]);
    await pool.execute('DELETE FROM members WHERE id IN (?, ?, ?)', [qcMemberId, annoMemberId, victimMemberId]);
  }
});
