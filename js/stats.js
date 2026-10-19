// =====================================================================
//  الحسابات الإحصائية — تُحسب من البيانات الأصلية فقط داخل المتصفح.
//  لا تُرسل أسماء الطالبات لأي خدمة خارجية؛ الذكاء الاصطناعي يستلم الأرقام المجمعة فقط.
// =====================================================================

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/٫/g, '.').replace(/،/g, ',').replace(/%$/, '').trim();
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (/^[-+]?\d+,\d+$/.test(s)) return parseFloat(s.replace(',', '.'));
  return null;
}

const isBlank = v => v === null || v === undefined || String(v).trim() === '';
const norm = s => String(s ?? '').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim().toLowerCase();

export function round(x, d = 1) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const p = 10 ** d; return Math.round(x * p) / p;
}

export function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function stdev(arr, mean) {
  if (arr.length < 2) return null;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1));
}

// يجد صف العناوين: أول صف (من أول 15) فيه عنوانان نصيان على الأقل وتليه صفوف فيها أرقام
export function findHeaderRow(rows) {
  const lim = Math.min(rows.length, 15);
  let best = 0, bestScore = -1;
  for (let i = 0; i < lim; i++) {
    const r = rows[i] || [];
    const textCells = r.filter(c => !isBlank(c) && toNumber(c) === null).length;
    let numBelow = 0;
    for (let j = i + 1; j < Math.min(rows.length, i + 6); j++)
      numBelow += (rows[j] || []).filter(c => toNumber(c) !== null).length;
    const score = textCells * 2 + Math.min(numBelow, 20);
    if (textCells >= 2 && score > bestScore) { best = i; bestScore = score; }
  }
  return best;
}

const ID_HEADERS = ['م', 'رقم', 'الرقم', 'ت', 'تسلسل', 'السجل', 'هويه', 'الهويه', 'سجل مدني', 'جوال', 'هاتف', 'id', 'no', '#', 'رقم الطالبه', 'رقم الهويه', 'الفصل', 'الشعبه', 'الصف'];
const NAME_HEADERS = ['اسم', 'الاسم', 'الطالبه', 'name', 'student'];
const TOTAL_HEADERS = ['المجموع', 'مجموع', 'الدرجه', 'النهائي', 'الكلي', 'total', 'المجموع الكلي', 'الدرجه النهائيه', 'الاجمالي'];
const MAX_ROW_HINTS = ['العظمي', 'الدرجه الكامله', 'الدرجه العظمي', 'max', 'من'];

function headerMax(h) {
  const s = String(h ?? '').replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
  const m = s.match(/(?:من|\/|out of|max)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/i) || s.match(/\((\d+(?:\.\d+)?)\)\s*$/);
  return m ? parseFloat(m[1]) : null;
}

// يقرأ جدول درجات ويحسب الإحصاءات الفعلية
// opts: { maxScore, passPct (افتراضي 50), masteryPct (اختياري), mode: 'period'|'diagnostic' }
export function analyzeGradeSheet(rows, opts = {}) {
  const passPct = opts.passPct ?? 50;
  const masteryPct = opts.masteryPct ?? null;
  const issues = [];
  rows = (rows || []).map(r => Array.isArray(r) ? r : []);
  if (rows.length < 2) return { kind: 'grades', ok: false, error: 'الملف لا يحتوي بيانات كافية', issues };

  const h = findHeaderRow(rows);
  const header = (rows[h] || []).map(c => String(c ?? '').trim());
  const ncol = Math.max(...rows.map(r => r.length), header.length);

  // صف الدرجة العظمى إن وُجد (أسفل العنوان مباشرة غالباً)
  let maxRowIdx = -1;
  for (let i = h + 1; i < Math.min(rows.length, h + 4); i++) {
    const r = rows[i] || [];
    if (r.some(c => typeof c === 'string' && MAX_ROW_HINTS.some(k => norm(c).includes(norm(k))) && norm(c).length < 30)) { maxRowIdx = i; break; }
  }

  const body = [];
  for (let i = h + 1; i < rows.length; i++) {
    if (i === maxRowIdx) continue;
    const r = rows[i];
    if (!r || r.every(isBlank)) continue;
    // تجاهل صفوف الملخص (المتوسط، المجموع...) في نهاية الجدول
    const first = r.find(c => !isBlank(c));
    if (typeof first === 'string' && /^(المتوسط|متوسط|المجموع الكلي|النسبه|نسبه النجاح|الاجمالي|average|total)$/i.test(norm(first))) continue;
    body.push(r);
  }
  if (!body.length) return { kind: 'grades', ok: false, error: 'لم يتم العثور على صفوف بيانات أسفل العناوين', issues };

  // تحديد عمود الاسم
  let nameCol = -1;
  header.forEach((t, c) => { if (nameCol < 0 && NAME_HEADERS.some(k => norm(t).includes(norm(k))) && !norm(t).includes('معلم')) nameCol = c; });
  if (nameCol < 0) {
    let bestC = -1, bestText = 0;
    for (let c = 0; c < ncol; c++) {
      const texts = body.filter(r => !isBlank(r[c]) && toNumber(r[c]) === null && String(r[c]).trim().length > 4).length;
      if (texts > bestText) { bestText = texts; bestC = c; }
    }
    if (bestText >= body.length * 0.5) nameCol = bestC;
  }

  // أعمدة الدرجات
  const scoreCols = [];
  for (let c = 0; c < ncol; c++) {
    if (c === nameCol) continue;
    const t = header[c] || '';
    const nt = norm(t);
    if (ID_HEADERS.some(k => nt === norm(k) || nt.startsWith(norm(k) + ' ')) && !TOTAL_HEADERS.some(k => nt.includes(norm(k)))) continue;
    const vals = body.map(r => r[c]).filter(v => !isBlank(v));
    if (!vals.length) continue;
    const nums = vals.map(toNumber).filter(v => v !== null);
    if (nums.length < vals.length * 0.6 || nums.length < 2) continue;
    // أرقام الهوية والجوال كبيرة جداً
    if (median(nums) > 1000) continue;
    // تسلسل 1..n
    const seq = nums.every((v, i) => v === i + 1);
    if (seq && c < 2) continue;
    scoreCols.push(c);
  }
  if (!scoreCols.length) return { kind: 'grades', ok: false, error: 'لم يتم العثور على أعمدة درجات رقمية', issues, header };

  // تكرار الأسماء
  const names = nameCol >= 0 ? body.map(r => String(r[nameCol] ?? '').trim()).filter(Boolean) : [];
  const seen = new Map();
  names.forEach(n => seen.set(norm(n), (seen.get(norm(n)) || 0) + 1));
  const dups = [...seen.values()].filter(x => x > 1).length;
  if (dups) issues.push({ type: 'duplicate_names', message: `يوجد ${dups} اسماً مكرراً في الكشف` });
  const noName = nameCol >= 0 ? body.filter(r => isBlank(r[nameCol])).length : 0;
  if (noName) issues.push({ type: 'missing_names', message: `${noName} صفاً بدون اسم طالبة` });

  const columns = scoreCols.map(c => {
    const label = header[c] || `عمود ${c + 1}`;
    let max = headerMax(label);
    if (max === null && maxRowIdx >= 0) max = toNumber(rows[maxRowIdx][c]);
    const raw = body.map(r => r[c]);
    const nums = [], nonNumeric = [];
    let blanks = 0;
    raw.forEach(v => {
      if (isBlank(v)) { blanks++; return; }
      const n = toNumber(v);
      if (n === null) nonNumeric.push(String(v).trim()); else nums.push(n);
    });
    const isTotal = TOTAL_HEADERS.some(k => norm(label).includes(norm(k)));
    if (max === null && isTotal && opts.maxScore) max = opts.maxScore;
    if (max === null && scoreCols.length === 1 && opts.maxScore) max = opts.maxScore;
    if (max === null && !isTotal && opts.maxPerColumn) max = opts.maxPerColumn;
    const obsMax = nums.length ? Math.max(...nums) : null;
    const obsMin = nums.length ? Math.min(...nums) : null;
    const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    const col = {
      col: c, label, is_total: isTotal, max, max_known: max !== null,
      n: nums.length, blanks, non_numeric: nonNumeric.length,
      non_numeric_values: [...new Set(nonNumeric)].slice(0, 5),
      mean: round(mean, 2), median: round(median(nums), 2), min: obsMin, max_observed: obsMax,
      stdev: round(stdev(nums, mean), 2),
    };
    const colIssues = [];
    if (max !== null) {
      const over = nums.filter(v => v > max).length;
      const neg = nums.filter(v => v < 0).length;
      if (over) colIssues.push(`${over} درجة أعلى من الدرجة العظمى (${max})`);
      if (neg) colIssues.push(`${neg} درجة سالبة`);
      const valid = nums.filter(v => v >= 0 && v <= max);
      const pct = valid.map(v => 100 * v / max);
      col.mean_pct = round(pct.length ? pct.reduce((a, b) => a + b, 0) / pct.length : null, 1);
      col.pass_threshold = round(max * passPct / 100, 2);
      col.passed = pct.filter(p => p >= passPct).length;
      col.pass_rate = pct.length ? round(100 * col.passed / pct.length, 1) : null;
      if (masteryPct !== null && masteryPct !== undefined) {
        col.mastery_threshold = round(max * masteryPct / 100, 2);
        col.mastered = pct.filter(p => p >= masteryPct).length;
        col.mastery_rate = pct.length ? round(100 * col.mastered / pct.length, 1) : null;
      }
      col.levels = levelsOf(pct, passPct);
    } else {
      colIssues.push('الدرجة العظمى غير معروفة؛ لا يمكن حساب نسبة النجاح أو الإتقان');
    }
    if (blanks) colIssues.push(`${blanks} خلية فارغة`);
    if (nonNumeric.length) colIssues.push(`${nonNumeric.length} قيمة غير رقمية (${col.non_numeric_values.join('، ')})`);
    col.issues = colIssues;
    return col;
  });

  const mainCol = columns.find(c => c.is_total) || (columns.length === 1 ? columns[0] : columns[columns.length - 1]);

  const result = {
    kind: 'grades', ok: true, mode: opts.mode || 'period',
    header_row: h + 1, students: body.length, name_column: nameCol >= 0 ? header[nameCol] || null : null,
    pass_pct: passPct, mastery_pct: masteryPct,
    columns, main_column: mainCol ? mainCol.label : null, issues,
  };

  // التشخيصي: كل عمود يمثل مهارة
  if (opts.mode === 'diagnostic') {
    const skillCols = columns.filter(c => !c.is_total);
    const thr = masteryPct ?? null;
    result.skills = skillCols.map(c => ({
      skill: c.label, n: c.n, mean_pct: c.mean_pct ?? null,
      mastery_rate: c.mastery_rate ?? null, mastered: c.mastered ?? null,
      not_mastered: c.mastered !== undefined && c.mastered !== null ? c.n - c.mastered : null,
      status: thr === null || c.mastery_rate === null || c.mastery_rate === undefined ? 'unknown'
        : c.mastery_rate >= 70 ? 'mastered' : c.mastery_rate >= 50 ? 'partial' : 'needs_intervention',
    }));
    if (thr === null) issues.push({ type: 'no_mastery', message: 'لم يُحدد معيار الإتقان؛ لا يمكن الحكم على إتقان المهارات' });
  }

  // أعداد الطالبات في كل مستوى (للعمود الرئيسي) — قائمة بأرقام الصفوف فقط دون أسماء
  return result;
}

export function levelsOf(pcts, passPct = 50) {
  const L = { 'ممتاز (90٪ فأكثر)': 0, 'جيد جداً (80–89٪)': 0, 'جيد (70–79٪)': 0, [`مقبول (${passPct}–69٪)`]: 0, [`دون الحد (أقل من ${passPct}٪)`]: 0 };
  const keys = Object.keys(L);
  pcts.forEach(p => {
    if (p >= 90) L[keys[0]]++; else if (p >= 80) L[keys[1]]++; else if (p >= 70) L[keys[2]]++;
    else if (p >= passPct) L[keys[3]]++; else L[keys[4]]++;
  });
  return L;
}

// ---------------------------------------------------------------------
//  استبانات رضا أولياء الأمور
// ---------------------------------------------------------------------
const LIKERT = [
  [5, ['موافق بشده', 'موافقه بشده', 'راض جدا', 'راضي جدا', 'راضيه جدا', 'ممتاز', 'دائما', 'كبيره جدا', 'عاليه جدا', 'strongly agree', 'very satisfied', 'excellent']],
  [4, ['موافق', 'موافقه', 'راض', 'راضي', 'راضيه', 'جيد جدا', 'غالبا', 'كبيره', 'عاليه', 'agree', 'satisfied', 'very good']],
  [3, ['محايد', 'محايده', 'الي حد ما', 'متوسط', 'متوسطه', 'جيد', 'احيانا', 'neutral', 'good', 'somewhat']],
  [2, ['غير موافق', 'غير موافقه', 'غير راض', 'غير راضي', 'غير راضيه', 'ضعيف', 'نادرا', 'قليله', 'منخفضه', 'disagree', 'unsatisfied', 'dissatisfied', 'poor']],
  [1, ['غير موافق بشده', 'غير موافقه بشده', 'غير راض اطلاقا', 'غير راض تماما', 'ضعيف جدا', 'ابدا', 'لا اطلاقا', 'strongly disagree', 'very dissatisfied', 'very poor']],
];
export function likertValue(v) {
  if (isBlank(v)) return null;
  const n = toNumber(v);
  if (n !== null) return n >= 1 && n <= 5 && Number.isInteger(n) ? n : null;
  const s = norm(v).replace(/\s+/g, ' ');
  // الأطول أولاً لتفادي مطابقة "موافق" داخل "غير موافق بشدة"
  const all = LIKERT.flatMap(([val, ws]) => ws.map(w => [val, norm(w)])).sort((a, b) => b[1].length - a[1].length);
  for (const [val, w] of all) if (s === w) return val;
  for (const [val, w] of all) if (s.startsWith(w)) return val;
  return null;
}

export function analyzeSurvey(rows) {
  rows = (rows || []).map(r => Array.isArray(r) ? r : []);
  const issues = [];
  if (rows.length < 2) return { kind: 'survey', ok: false, error: 'الملف لا يحتوي بيانات كافية', issues };
  const h = findHeaderRow(rows) || 0;
  const header = (rows[h] || []).map(c => String(c ?? '').trim());
  const body = rows.slice(h + 1).filter(r => r && !r.every(isBlank));
  const ncol = Math.max(header.length, ...body.map(r => r.length));
  const questions = [], commentCols = [];
  for (let c = 0; c < ncol; c++) {
    const label = header[c] || `سؤال ${c + 1}`;
    if (/طابع زمني|timestamp|التاريخ|الوقت|البريد|email|اسم|name|جوال|phone/i.test(label)) continue;
    const vals = body.map(r => r[c]).filter(v => !isBlank(v));
    if (!vals.length) continue;
    const mapped = vals.map(likertValue);
    const ok = mapped.filter(v => v !== null);
    if (ok.length >= vals.length * 0.7 && ok.length >= 2) {
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      ok.forEach(v => dist[v]++);
      const mean = ok.reduce((a, b) => a + b, 0) / ok.length;
      questions.push({
        col: c, question: label, n: ok.length, unmapped: vals.length - ok.length, distribution: dist,
        mean: round(mean, 2),
        agree_pct: round(100 * (dist[5] + dist[4]) / ok.length, 1),
        neutral_pct: round(100 * dist[3] / ok.length, 1),
        disagree_pct: round(100 * (dist[2] + dist[1]) / ok.length, 1),
      });
    } else {
      const avgLen = vals.reduce((s, v) => s + String(v).length, 0) / vals.length;
      if (avgLen > 12) commentCols.push({ col: c, label });
    }
  }
  const responses = body.filter(r => questions.some(q => likertValue(r[q.col]) !== null)).length;
  const comments = [];
  commentCols.forEach(cc => body.forEach(r => { if (!isBlank(r[cc.col])) comments.push(String(r[cc.col]).trim()); }));
  if (!questions.length) issues.push({ type: 'no_likert', message: 'لم يتم التعرف على أسئلة بمقياس (موافق/محايد/غير موافق) أو (1–5)' });
  questions.forEach(q => { if (q.unmapped) issues.push({ type: 'unmapped', message: `${q.unmapped} إجابة غير مفهومة في: ${q.question}` }); });
  const sorted = [...questions].sort((a, b) => b.mean - a.mean);
  const overall = questions.length ? round(questions.reduce((s, q) => s + q.mean, 0) / questions.length, 2) : null;
  return {
    kind: 'survey', ok: questions.length > 0, responses, questions_count: questions.length,
    overall_mean: overall, overall_pct: overall !== null ? round(100 * (overall - 1) / 4, 1) : null,
    questions, top: sorted.slice(0, 3).map(q => q.question), bottom: sorted.slice(-3).reverse().map(q => q.question),
    comments_count: comments.length, comment_columns: commentCols.map(c => c.label),
    comments, issues,
  };
}

// نسخة آمنة لإرسالها للذكاء الاصطناعي: أرقام مجمعة فقط بلا أسماء ولا تعليقات
export function safeStatsForAI(stats, { includeComments = false } = {}) {
  if (!stats) return null;
  const s = JSON.parse(JSON.stringify(stats));
  if (s.kind === 'survey') {
    if (!includeComments) delete s.comments;
    else s.comments = (s.comments || []).slice(0, 150).map(c => c.slice(0, 400));
  }
  if (s.columns) s.columns.forEach(c => { delete c.non_numeric_values; });
  return s;
}

// مقارنة فترتين — فقط عند تطابق المادة والصف ووجود درجة عظمى معروفة
export function comparePeriods(a, b) {
  const ca = a?.columns?.find(c => c.label === a.main_column);
  const cb = b?.columns?.find(c => c.label === b.main_column);
  if (!ca || !cb || ca.mean_pct == null || cb.mean_pct == null)
    return { comparable: false, reason: 'لا تتوفر بيانات قابلة للمقارنة (الدرجة العظمى أو العمود الرئيسي غير معروف في أحد الملفين)' };
  return {
    comparable: true,
    mean_pct_a: ca.mean_pct, mean_pct_b: cb.mean_pct, diff_mean_pct: round(cb.mean_pct - ca.mean_pct, 1),
    pass_rate_a: ca.pass_rate, pass_rate_b: cb.pass_rate,
    diff_pass_rate: ca.pass_rate != null && cb.pass_rate != null ? round(cb.pass_rate - ca.pass_rate, 1) : null,
    n_a: ca.n, n_b: cb.n,
  };
}
