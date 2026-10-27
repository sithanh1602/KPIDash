import ExcelJS from 'exceljs';

export interface ToolQaParsedResult {
  cuboids: number;
  totalWarnings: number;
  warningPercent: number;
  s: number;
  k: number;
  z: number;
  h: number;
  o: number;
  d: number;
  riskHigh: number;
  riskMid: number;
  riskLow: number;
  highRiskTracks: Array<{
    trackNo: string;
    className: string;
    totalIssues: number;
    warnings: string;
    symptom: string;
  }>;
  suggestedCoaching: {
    focusTags: string;
    commonErrors: string;
    training: string;
    goals: string;
  };
}

export async function parseToolQaBuffer(buffer: Buffer): Promise<ToolQaParsedResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  let cuboids = 0;
  let s = 0, k = 0, z = 0, h = 0, o = 0, d = 0;
  let riskHigh = 0, riskMid = 0, riskLow = 0;
  const highRiskTracks: ToolQaParsedResult['highRiskTracks'] = [];

  // 1. Phân tích từ sheet Summary nếu có
  const summarySheet = wb.getWorksheet('Summary');
  if (summarySheet) {
    summarySheet.eachRow((row) => {
      const c1 = String(row.getCell(1).value || '').trim();
      const c1Lower = c1.toLowerCase();
      const c2 = String(row.getCell(2).value || '').trim().toUpperCase();
      const c3 = Number(row.getCell(3).value) || 0;

      if (c1Lower.includes('số cuboid') || c1Lower.includes('cuboid_3d')) {
        cuboids = Number(row.getCell(2).value) || 0;
      }

      if (c2 === 'S' || c1Lower.includes('scale')) s = c3 || s;
      if (c2 === 'K' || c1Lower.includes('kích thước')) k = c3 || k;
      if (c2 === 'Z' || c1Lower.includes('z ngoài')) z = c3 || z;
      if (c2 === 'H' || c1Lower.includes('hướng')) h = c3 || h;
      if (c2 === 'O' || c1Lower.includes('chồng lấn')) o = c3 || o;
      if (c2 === 'D' || c1Lower.includes('quá xa')) d = c3 || d;
    });
  }

  // 2. Phân tích từ sheet Matrix (đặc biệt khi Summary không có hoặc bổ sung)
  const matrixSheet = wb.getWorksheet('Matrix') || wb.getWorksheet('matrix');
  if (matrixSheet) {
    let matrixS = 0, matrixK = 0, matrixZ = 0, matrixH = 0, matrixO = 0, matrixD = 0;
    // Bắt đầu từ dòng chứa data (thường là dòng 4)
    for (let r = 3; r <= matrixSheet.rowCount; r++) {
      const row = matrixSheet.getRow(r);
      for (let c = 4; c <= matrixSheet.columnCount; c++) {
        const val = String(row.getCell(c).value || '').trim().toUpperCase();
        if (!val) continue;
        if (val.includes('S')) matrixS++;
        if (val.includes('K')) matrixK++;
        if (val.includes('Z')) matrixZ++;
        if (val.includes('H')) matrixH++;
        if (val.includes('O')) matrixO++;
        if (val.includes('D')) matrixD++;
      }
    }
    // Nếu Summary chưa lấy được, lấy từ Matrix
    if (s === 0 && matrixS > 0) s = matrixS;
    if (k === 0 && matrixK > 0) k = matrixK;
    if (z === 0 && matrixZ > 0) z = matrixZ;
    if (h === 0 && matrixH > 0) h = matrixH;
    if (o === 0 && matrixO > 0) o = matrixO;
    if (d === 0 && matrixD > 0) d = matrixD;
  }

  // 3. Phân tích rủi ro & track từ sheet By_Track
  const byTrackSheet = wb.getWorksheet('By_Track') || wb.getWorksheet('by_track');
  if (byTrackSheet) {
    const rawTrackItems: Array<{ trackId: any; cls: string; total: number; detail: string; types: string[] }> = [];

    for (let r = 2; r <= byTrackSheet.rowCount; r++) {
      const row = byTrackSheet.getRow(r);
      const trackId = row.getCell(1).value;
      if (trackId === null || trackId === undefined || trackId === '') continue;

      const cls = String(row.getCell(2).value || 'object');
      const totalIssues = Number(row.getCell(6).value) || 0;

      const sDetail = row.getCell(8).value;
      const kDetail = row.getCell(9).value;
      const zDetail = row.getCell(10).value;
      const hDetail = row.getCell(11).value;
      const oDetail = row.getCell(12).value;
      const dDetail = row.getCell(13).value;

      const types: string[] = [];
      const descriptions: string[] = [];
      if (sDetail) { types.push('S'); descriptions.push(`Scale không đồng bộ (${sDetail})`); }
      if (kDetail) { types.push('K'); descriptions.push(`Kích thước ngoài ngưỡng (${kDetail})`); }
      if (zDetail) { types.push('Z'); descriptions.push(`Z ngoài ngưỡng (${zDetail})`); }
      if (hDetail) { types.push('H'); descriptions.push(`Đổi hướng đột ngột (${hDetail})`); }
      if (oDetail) { types.push('O'); descriptions.push(`Chồng lấn (${oDetail})`); }
      if (dDetail) { types.push('D'); descriptions.push(`Quá xa (${dDetail})`); }

      if (totalIssues >= 20) {
        riskHigh++;
      } else if (totalIssues >= 5) {
        riskMid++;
      } else if (totalIssues > 0) {
        riskLow++;
      }

      if (totalIssues > 0) {
        rawTrackItems.push({
          trackId,
          cls,
          total: totalIssues,
          detail: descriptions.join(' · '),
          types,
        });
      }
    }

    // Lấy top 8 track rủi ro cao nhất đưa vào đề xuất Shared Track
    rawTrackItems.sort((a, b) => b.total - a.total);
    rawTrackItems.slice(0, 8).forEach((t) => {
      highRiskTracks.push({
        trackNo: `Track ${t.trackId}`,
        className: t.cls,
        totalIssues: t.total,
        warnings: `${t.total} cảnh báo (${t.types.join(', ') || 'QA'})`,
        symptom: t.detail || `Phát hiện ${t.total} cảnh báo qua các frame`,
      });
    });
  }

  // Nếu cuboids vẫn = 0, thử lấy tổng số row hoặc từ By_Frame
  if (cuboids === 0) {
    const frameSheet = wb.getWorksheet('By_Frame');
    if (frameSheet) {
      let sum = 0;
      for (let r = 2; r <= frameSheet.rowCount; r++) {
        sum += Number(frameSheet.getRow(r).getCell(3).value) || 0;
      }
      if (sum > 0) cuboids = sum;
    }
  }

  const totalWarnings = s + k + z + h + o + d;
  const warningPercent = cuboids > 0 ? Number(((totalWarnings / cuboids) * 100).toFixed(1)) : 0;

  // 4. Tự động sinh nội dung Coaching dựa trên lỗi nhiều nhất của người này
  const categories = [
    { code: 'K', count: k, name: 'Kích thước ngoài ngưỡng', advice: 'Đối soát kỹ bảng kích thước chuẩn (L/W/H) với class two-wheels và pedestrian.' },
    { code: 'O', count: o, name: 'Chồng lấn bounding box', advice: 'Bật chế độ kiểm tra va chạm / overlap IoU trên tool trước khi complete.' },
    { code: 'S', count: s, name: 'Scale không đồng bộ', advice: 'Khóa tỉ lệ scale kích thước sau khi đã căn chỉnh chuẩn ở keyframe đầu.' },
    { code: 'H', count: h, name: 'Đổi hướng đột ngột (Yaw)', advice: 'Chú ý hướng vector di chuyển của xe khi rẽ hoặc quay đầu.' },
    { code: 'D', count: d, name: 'Vật thể quá xa', advice: 'Kiểm tra mật độ điểm pointcloud ở các frame xa.' },
    { code: 'Z', count: z, name: 'Cao độ Z ngoài ngưỡng', advice: 'Căn chỉnh đáy cuboid sát với mặt phẳng ground.' },
  ].filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

  const focusTags = categories.slice(0, 3).map((c) => c.name.toUpperCase()).join(' · ') || 'CẦN THEO DÕI';
  const commonErrors = categories
    .slice(0, 3)
    .map((c) => `• ${c.name} (${c.code}): ${c.count} cảnh báo (${totalWarnings > 0 ? Math.round((c.count / totalWarnings) * 100) : 0}% tổng cảnh báo).`)
    .join('\n');
  const training = categories
    .slice(0, 3)
    .map((c) => `• ${c.advice}`)
    .join('\n');
  const topCode = categories[0]?.code;
  const goals = topCode ? `Giảm 60% lỗi ${categories[0].name} ở bài tiếp theo` : 'Duy trì chất lượng không phát sinh cảnh báo';

  return {
    cuboids,
    totalWarnings,
    warningPercent,
    s,
    k,
    z,
    h,
    o,
    d,
    riskHigh,
    riskMid,
    riskLow,
    highRiskTracks,
    suggestedCoaching: {
      focusTags,
      commonErrors,
      training,
      goals,
    },
  };
}
