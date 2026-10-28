import { QA_TYPES } from './constants';
import { QaRow, SharedTrack, CoachingRow } from './types';
import { splitLines } from './text';

export interface DynamicQaResult {
  total: number;
  allTotal: number;
  percent: number;
  activeRatio: number;
}

/** Tính toán tổng số cảnh báo và % cảnh báo theo các loại lỗi đang được chọn */
export function getMemberDynamicQa(
  qa: QaRow | null | undefined,
  selectedQaTypes: string[],
): DynamicQaResult {
  if (!qa) {
    return { total: 0, allTotal: 0, percent: 0, activeRatio: 0 };
  }
  const total = QA_TYPES.reduce((acc, t) => {
    return selectedQaTypes.includes(t.key) ? acc + (Number(qa[t.key as keyof QaRow]) || 0) : acc;
  }, 0);
  const allTotal = QA_TYPES.reduce((acc, t) => {
    return acc + (Number(qa[t.key as keyof QaRow]) || 0);
  }, 0);
  const percent = qa.cuboids > 0 ? Number(((total / qa.cuboids) * 100).toFixed(1)) : 0;
  const activeRatio = allTotal > 0 ? total / allTotal : 0;
  return { total, allTotal, percent, activeRatio };
}

/** Kiểm tra và lọc cảnh báo của 1 track theo danh sách lỗi được chọn */
export interface DynamicTrackResult {
  isVisible: boolean;
  activeTypes: string[];
  totalWarnings: number;
  warningsText: string;
  symptomText: string;
}

export function filterTrack(
  track: SharedTrack,
  selectedQaTypes: string[],
): DynamicTrackResult {
  // 1. Trích xuất các mã lỗi trong chuỗi warnings: ví dụ "65 cảnh báo (S, K, D)"
  const codeMatch = track.warnings.match(/\(([^)]+)\)/);
  let rawCodes: string[] = [];
  if (codeMatch && codeMatch[1]) {
    rawCodes = codeMatch[1].split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  } else {
    // Nếu không có ngoặc, tìm các chữ cái đơn S, K, Z, H, O, D
    const found = track.warnings.match(/\b[SKZHOD]\b/g);
    if (found) rawCodes = found.map((c) => c.toUpperCase());
  }

  const trackKeys = rawCodes.map((c) => c.toLowerCase());
  const activeKeys = trackKeys.filter((k) => selectedQaTypes.includes(k));

  // Nếu track này có khai báo mã lỗi mà không có mã nào nằm trong selectedQaTypes -> ẩn
  if (trackKeys.length > 0 && activeKeys.length === 0) {
    return {
      isVisible: false,
      activeTypes: [],
      totalWarnings: 0,
      warningsText: '0 cảnh báo',
      symptomText: '',
    };
  }

  // 2. Phân tích và lọc symptom: các mục phân tách bằng " · "
  const symptomParts = track.symptom ? track.symptom.split(/\s*·\s*/) : [];
  const activeParts: string[] = [];
  let calculatedCount = 0;
  let hasExtractedCount = false;

  const keyForPart = (part: string): string | null => {
    const p = part.toLowerCase();
    if (p.includes('scale')) return 's';
    if (p.includes('kích thước')) return 'k';
    if (p.includes('z ngoài') || p.includes('độ cao') || p.includes('cao độ') || p.includes('mặt phẳng')) return 'z';
    if (p.includes('đổi hướng') || p.includes('hướng') || p.includes('yaw')) return 'h';
    if (p.includes('chồng lấn') || p.includes('overlap')) return 'o';
    if (p.includes('quá xa') || p.includes('vật thể quá xa')) return 'd';
    return null;
  };

  symptomParts.forEach((part) => {
    const key = keyForPart(part);
    if (key) {
      if (selectedQaTypes.includes(key)) {
        activeParts.push(part);
        // Tìm số cảnh báo trong ngoặc cuối: ví dụ (4)) ở cuối "Scale không đồng bộ (56-59 (4))"
        const countMatch = part.match(/\((\d+)\)[)\s]*$/);
        if (countMatch && countMatch[1]) {
          calculatedCount += parseInt(countMatch[1], 10);
          hasExtractedCount = true;
        }
      }
    } else {
      // Phần mô tả chung không khớp loại cụ thể -> giữ lại
      activeParts.push(part);
    }
  });

  const activeCodes = activeKeys.map((k) => k.toUpperCase());
  const origCountMatch = track.warnings.match(/^(\d+)/);
  const origCount = origCountMatch ? parseInt(origCountMatch[1], 10) : 0;
  const finalCount = hasExtractedCount ? calculatedCount : (activeCodes.length === trackKeys.length ? origCount : Math.max(1, Math.round(origCount * (activeCodes.length / (trackKeys.length || 1)))));

  const warningsText = activeCodes.length > 0
    ? `${finalCount} cảnh báo (${activeCodes.join(', ')})`
    : `${finalCount} cảnh báo`;

  return {
    isVisible: true,
    activeTypes: activeCodes,
    totalWarnings: finalCount,
    warningsText,
    symptomText: activeParts.join(' · ') || track.symptom,
  };
}

/** Tính toán số track rủi ro cao và nhận định đồng bộ theo selectedQaTypes */
export function getMemberDynamicRiskAndInsight(
  member: {
    name: string;
    grade: 'excellent' | 'normal' | 'below';
    qa?: QaRow | null;
  },
  selectedQaTypes: string[],
  tracks: SharedTrack[] = [],
): { riskHigh: number; insight: string } {
  const qa = member.qa;
  if (!qa) {
    const baseInsight = {
      excellent: 'Vượt KPI sản lượng · Đang cập nhật chất lượng',
      normal: 'Đạt KPI sản lượng · Đang cập nhật chất lượng',
      below: 'Không đạt KPI · Cần tăng tốc sản lượng',
    }[member.grade];
    return { riskHigh: 0, insight: baseInsight };
  }

  const { total, allTotal, activeRatio } = getMemberDynamicQa(qa, selectedQaTypes);

  // Nếu đã tắt hết loại cảnh báo mà người này mắc phải
  if (total === 0 && allTotal > 0) {
    const safeInsight = {
      excellent: 'Vượt KPI sản lượng · Đạt chuẩn chất lượng đã chọn',
      normal: 'Đạt KPI sản lượng · Đạt chuẩn chất lượng đã chọn',
      below: 'Không đạt KPI · Cần tăng tốc sản lượng',
    }[member.grade];
    return { riskHigh: 0, insight: safeInsight };
  }

  // Tìm các track trong danh sách shared tracks thuộc về người này
  const memberName = member.name.toLowerCase();
  const matchedTracks = tracks.filter((t) => {
    const inJobs = (t.inJobs || '').toLowerCase();
    return inJobs.includes(memberName);
  });

  let riskHigh = 0;
  if (matchedTracks.length > 0) {
    // Đếm số track còn hiển thị sau khi lọc loại lỗi
    riskHigh = matchedTracks.filter((t) => filterTrack(t, selectedQaTypes).isVisible).length;
  } else {
    // Nếu không khớp track chi tiết, tỉ lệ theo số cảnh báo kích hoạt
    riskHigh = Math.round(qa.riskHigh * activeRatio);
  }

  const riskStr = riskHigh > 0 ? `${riskHigh} track rủi ro cao` : '';
  let insight = '';
  if (member.grade === 'excellent') {
    insight = riskHigh > 0 ? `Vượt KPI sản lượng · ${riskStr} chờ QC` : 'Vượt KPI sản lượng · Chất lượng tốt';
  } else if (member.grade === 'normal') {
    insight = riskHigh > 0 ? `Đạt KPI sản lượng · ${riskStr} chờ QC` : 'Đạt KPI sản lượng · Không có track rủi ro cao';
  } else {
    insight = riskHigh > 0 ? `Không đạt KPI${riskStr ? ` và ${riskStr}` : ''} · kèm 1-1` : 'Không đạt KPI · Cần tăng tốc sản lượng';
  }

  return { riskHigh, insight };
}

/** Lọc nội dung Coaching (focusTags, commonErrors, training) theo selectedQaTypes */
export function filterMemberCoaching(
  coaching: CoachingRow | null | undefined,
  selectedQaTypes: string[],
): {
  focusTags: string;
  commonErrors: string[];
  training: string[];
  goals: string;
} {
  if (!coaching) {
    return { focusTags: '', commonErrors: [], training: [], goals: '' };
  }

  // 1. Lọc Focus tags (phân tách bởi " · ")
  const tagKeyMap: Record<string, string> = {
    'KÍCH THƯỚC': 'k',
    'SCALE': 's',
    'CHỒNG LẤN': 'o',
    'HƯỚNG': 'h',
    'QUÁ XA': 'd',
    'CAO ĐỘ': 'z',
    'ĐỘ CAO': 'z',
  };

  const origTags: string[] = coaching.focusTags ? coaching.focusTags.split(/\s*·\s*/) : [];
  const filteredTags = origTags.filter((tag: string) => {
    const upper = tag.toUpperCase();
    for (const [kw, key] of Object.entries(tagKeyMap)) {
      if (upper.includes(kw)) {
        return selectedQaTypes.includes(key);
      }
    }
    return true; // Nếu tag không nằm trong bộ QA thì giữ nguyên
  });

  const focusTags = filteredTags.join(' · ') || (selectedQaTypes.length === 0 ? 'CHẤT LƯỢNG ĐẠT' : 'CẦN THEO DÕI');

  // 2. Lọc Common Errors
  const origErrors = splitLines(coaching.commonErrors || '');
  const parsedErrors: { line: string; code: string; count: number; name: string }[] = [];

  origErrors.forEach((line) => {
    const codeMatch = line.match(/\(([SKZHOD])\)/i);
    const countMatch = line.match(/(\d+)\s*cảnh báo/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : '';
    const count = countMatch ? parseInt(countMatch[1], 10) : 0;
    parsedErrors.push({ line, code, count, name: line });
  });

  const activeErrors = parsedErrors.filter((item) => {
    if (!item.code) return true;
    return selectedQaTypes.includes(item.code.toLowerCase());
  });

  const activeTotal = activeErrors.reduce((sum, item) => sum + item.count, 0);

  const commonErrors = activeErrors.map((item) => {
    if (activeTotal > 0 && item.count > 0) {
      const newPercent = Math.round((item.count / activeTotal) * 100);
      // Thay thế phần "(X% tổng cảnh báo)" bằng % mới tính toán lại
      return item.line.replace(/\(\d+%\s*tổng cảnh báo\)/, `(${newPercent}% tổng cảnh báo)`);
    }
    return item.line;
  });

  // 3. Lọc Training đề xuất
  const origTraining = splitLines(coaching.training || '');
  const trainingKeyMap: Record<string, string> = {
    'kích thước': 'k',
    'scale': 's',
    'chồng lấn': 'o',
    'overlap': 'o',
    'hướng': 'h',
    'quá xa': 'd',
    'pointcloud ở các frame xa': 'd',
    'cao độ': 'z',
    'mặt phẳng ground': 'z',
  };

  const training = origTraining.filter((line) => {
    const lower = line.toLowerCase();
    for (const [kw, key] of Object.entries(trainingKeyMap)) {
      if (lower.includes(kw)) {
        return selectedQaTypes.includes(key);
      }
    }
    return true;
  });

  // 4. Goals
  let goals = coaching.goals || '';
  if (!selectedQaTypes.includes('k') && goals.toLowerCase().includes('kích thước')) {
    goals = activeErrors.length > 0
      ? `Tập trung giảm cảnh báo ${activeErrors[0].code} ở bài tiếp theo`
      : 'Duy trì chất lượng không phát sinh cảnh báo';
  }

  return {
    focusTags,
    commonErrors,
    training,
    goals,
  };
}
