import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMemberDynamicQa,
  filterTrack,
  getMemberDynamicRiskAndInsight,
  filterMemberCoaching,
} from './qa';
import { QaRow, SharedTrack, CoachingRow } from './types';

test('1. getMemberDynamicQa: tính toán lại số lượng và % cảnh báo theo checkbox', () => {
  const qa: QaRow = {
    jobCode: 'JOB_01',
    qcName: 'QC Lead',
    cuboids: 1000,
    warningPercent: 100.0,
    s: 50,
    k: 800,
    z: 0,
    h: 50,
    o: 100,
    d: 0,
    riskHigh: 10,
    riskMid: 2,
    riskLow: 1,
  };

  // Đủ 6 loại: tổng = 50 + 800 + 0 + 50 + 100 + 0 = 1000, percent = 100.0%
  const resAll = getMemberDynamicQa(qa, ['s', 'k', 'z', 'h', 'o', 'd']);
  assert.equal(resAll.total, 1000);
  assert.equal(resAll.percent, 100.0);

  // Bỏ chọn K: tổng = 50 + 50 + 100 = 200, percent = 20.0%
  const resNoK = getMemberDynamicQa(qa, ['s', 'z', 'h', 'o', 'd']);
  assert.equal(resNoK.total, 200);
  assert.equal(resNoK.percent, 20.0);

  // Tích lại K: tính lại đầy đủ
  const resWithK = getMemberDynamicQa(qa, ['s', 'k', 'z', 'h', 'o', 'd']);
  assert.equal(resWithK.total, 1000);
  assert.equal(resWithK.percent, 100.0);
});

test('2. filterTrack: track chỉ chứa lỗi K sẽ bị ẩn khi bỏ K, track kết hợp sẽ cập nhật chuỗi và biểu hiện', () => {
  const trackOnlyK: SharedTrack = {
    id: 1,
    trackNo: 'Track 10',
    className: 'two-wheels',
    jobCount: 1,
    inJobs: 'thinhnv (Nguyễn Văn Thịnh)',
    warnings: '57 cảnh báo (K)',
    symptom: 'Kích thước ngoài ngưỡng (0-17, 19-31, 34-59 (57))',
  };

  const trackMulti: SharedTrack = {
    id: 2,
    trackNo: 'Track 52',
    className: 'vehicles',
    jobCount: 1,
    inJobs: 'thinhnv (Nguyễn Văn Thịnh)',
    warnings: '65 cảnh báo (S, K, D)',
    symptom: 'Scale không đồng bộ (56-59 (4)) · Kích thước ngoài ngưỡng (0-49, 56-59 (54)) · Quá xa (47-49, 56-59 (7))',
  };

  // Khi có đủ loại lỗi
  const resOnlyKAll = filterTrack(trackOnlyK, ['s', 'k', 'z', 'h', 'o', 'd']);
  assert.equal(resOnlyKAll.isVisible, true);
  assert.deepEqual(resOnlyKAll.activeTypes, ['K']);

  // Khi BỎ CHỌN K:
  // Track 10 chỉ chứa K nên isVisible = false (ẩn khỏi danh sách lỗi chung)
  const resOnlyKNoK = filterTrack(trackOnlyK, ['s', 'z', 'h', 'o', 'd']);
  assert.equal(resOnlyKNoK.isVisible, false);

  // Track 52 chứa (S, K, D) khi bỏ K vẫn hiển thị nhưng chỉ còn S và D
  const resMultiNoK = filterTrack(trackMulti, ['s', 'z', 'h', 'o', 'd']);
  assert.equal(resMultiNoK.isVisible, true);
  assert.deepEqual(resMultiNoK.activeTypes, ['S', 'D']);
  assert.equal(resMultiNoK.totalWarnings, 11); // 4 + 7 = 11
  assert.match(resMultiNoK.warningsText, /11 cảnh báo \(S, D\)/);
  // Biểu hiện lỗi đã lọc bỏ phần "Kích thước ngoài ngưỡng"
  assert.ok(!resMultiNoK.symptomText.includes('Kích thước ngoài ngưỡng'));
  assert.ok(resMultiNoK.symptomText.includes('Scale không đồng bộ'));
  assert.ok(resMultiNoK.symptomText.includes('Quá xa'));
});

test('3. getMemberDynamicRiskAndInsight: kết hợp sản lượng và rủi ro để đưa ra nhận định động', () => {
  const member = {
    name: 'Nguyễn Văn Thịnh',
    grade: 'excellent' as const,
    qa: {
      jobCode: 'JOB_01',
      qcName: 'QC Lead',
      cuboids: 1000,
      warningPercent: 10.0,
      s: 0,
      k: 100,
      z: 0,
      h: 0,
      o: 0,
      d: 0,
      riskHigh: 5,
      riskMid: 0,
      riskLow: 0,
    },
  };

  const tracks: SharedTrack[] = [
    { id: 1, trackNo: 'Track 1', className: 'car', jobCount: 1, inJobs: 'Nguyễn Văn Thịnh', warnings: '50 cảnh báo (K)', symptom: 'Kích thước ngoài ngưỡng' },
    { id: 2, trackNo: 'Track 2', className: 'car', jobCount: 1, inJobs: 'Nguyễn Văn Thịnh', warnings: '50 cảnh báo (K)', symptom: 'Kích thước ngoài ngưỡng' },
  ];

  // Khi tích K: có 2 track rủi ro cao -> Xuất sắc sản lượng · 2 track rủi ro cao chờ QC
  const resAll = getMemberDynamicRiskAndInsight(member, ['s', 'k', 'z', 'h', 'o', 'd'], tracks);
  assert.equal(resAll.riskHigh, 2);
  assert.ok(resAll.insight.includes('2 track rủi ro cao chờ QC'));

  // Khi BỎ CHỌN K: các track K đều bị lọc, người này không còn lỗi nào đang chọn
  const resNoK = getMemberDynamicRiskAndInsight(member, ['s', 'z', 'h', 'o', 'd'], tracks);
  assert.equal(resNoK.riskHigh, 0);
  assert.ok(resNoK.insight.includes('Chất lượng tốt') || resNoK.insight.includes('Đạt chuẩn chất lượng đã chọn'));
});

test('4. filterMemberCoaching: đồng bộ lỗi hay gặp, tag và training theo checkbox', () => {
  const coaching: CoachingRow = {
    focusTags: 'KÍCH THƯỚC NGOÀI NGƯỠNG · CHỒNG LẤN BOUNDING BOX · VẬT THỂ QUÁ XA',
    style: 'Cẩn thận',
    commonErrors: '• Kích thước ngoài ngưỡng (K): 800 cảnh báo (80% tổng cảnh báo).\n• Chồng lấn bounding box (O): 100 cảnh báo (10% tổng cảnh báo).\n• Vật thể quá xa (D): 100 cảnh báo (10% tổng cảnh báo).',
    training: '• Đối soát kỹ bảng kích thước chuẩn (L/W/H) với class two-wheels.\n• Bật chế độ kiểm tra va chạm / overlap IoU trên tool.\n• Kiểm tra mật độ điểm pointcloud ở các frame xa.',
    absenceNote: '',
    goals: 'Giảm 60% lỗi Kích thước ngoài ngưỡng ở bài tiếp theo',
  };

  // Khi có đủ K, O, D
  const full = filterMemberCoaching(coaching, ['k', 'o', 'd']);
  assert.ok(full.focusTags.includes('KÍCH THƯỚC NGOÀI NGƯỠNG'));
  assert.equal(full.commonErrors.length, 3);
  assert.equal(full.training.length, 3);

  // Khi BỎ CHỌN K:
  const noK = filterMemberCoaching(coaching, ['o', 'd']);
  // Tag Kích thước bị bỏ
  assert.ok(!noK.focusTags.includes('KÍCH THƯỚC NGOÀI NGƯỠNG'));
  assert.ok(noK.focusTags.includes('CHỒNG LẤN BOUNDING BOX'));
  // Lỗi Kích thước bị bỏ khỏi Lỗi hay gặp
  assert.equal(noK.commonErrors.length, 2);
  assert.ok(!noK.commonErrors[0].includes('(K)'));
  // % của O và D được tính toán lại: mỗi lỗi 100 / 200 = 50%
  assert.ok(noK.commonErrors[0].includes('50% tổng cảnh báo'));
  assert.ok(noK.commonErrors[1].includes('50% tổng cảnh báo'));
  // Training đối soát kích thước bị lọc
  assert.equal(noK.training.length, 2);
  assert.ok(!noK.training.some((t) => t.includes('kích thước')));
});
