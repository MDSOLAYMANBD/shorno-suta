/**
 * Unified salary slip template — used by BOTH the running monthly summary
 * (চলতি মাসের কার্ড) and the finalized saved record (চূড়ান্ত মেমো).
 * Polished, branded, A5, fully Bengali.
 */

const monthNamesBn: Record<number, string> = {
  1: 'জানুয়ারি', 2: 'ফেব্রুয়ারি', 3: 'মার্চ', 4: 'এপ্রিল',
  5: 'মে', 6: 'জুন', 7: 'জুলাই', 8: 'আগস্ট',
  9: 'সেপ্টেম্বর', 10: 'অক্টোবর', 11: 'নভেম্বর', 12: 'ডিসেম্বর',
};

const bnDigit = (n: number | string) =>
  String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);

const fmt = (n: number) => bnDigit(Math.round(Number(n) || 0).toLocaleString('en-IN'));

export interface SalarySlipInput {
  personName: string;
  personId?: string;
  personCode?: string;
  role?: string;
  joiningDate?: string | null;
  unitName?: string | null;
  brandNameBn?: string;
  brandNameEn?: string;
  storeAddress?: string;
  storePhone?: string;
  /** Pass "চলমান" for the running-month card so the slip is clearly distinguishable */
  badgeLabel?: string;
  record: {
    month: number;
    year: number;
    working_days?: number;
    present_days: number;
    absent_days: number;
    off_days: number;
    late_days?: number;
    base_salary: number;
    deduction: number;
    bonus_amount?: number;
    bonus_note?: string | null;
    overtime_amount?: number;
    overtime_note?: string | null;
    paid_amount?: number;
    received_amount?: number;
    received_note?: string | null;
    advance_amount?: number;
    advance_note?: string | null;
    final_salary?: number;
    /** Amount being handed over right now during print/settlement */
    pay_now_amount?: number;
    pay_now_note?: string | null;
    /** When true, memo declares the bill fully settled (any remaining balance treated as paid in full) */
    mark_paid?: boolean;
  };
  totalDaysInMonth?: number;
}

export function buildSalarySlipHtml(input: SalarySlipInput): string {
  const {
    personName, personId, personCode, role, joiningDate, unitName,
    brandNameBn = 'স্বর্ণ সুতা', brandNameEn = 'Shorno Suta',
    storeAddress = '', storePhone = '', badgeLabel,
    record,
  } = input;

  const totalDays = input.totalDaysInMonth || new Date(record.year, record.month, 0).getDate();
  const base = Number(record.base_salary || 0);
  const deduction = Number(record.deduction || 0);
  const bonus = Number(record.bonus_amount || 0);
  const overtime = Number(record.overtime_amount || 0);
  const finalSalary = Math.max(0, base - deduction + bonus + overtime);
  const paid = Number(record.received_amount ?? record.paid_amount ?? 0);
  const advance = Number(record.advance_amount || 0);
  const oldBalance = finalSalary - paid - advance;
  const markPaid = !!record.mark_paid;
  const payNowRaw = Number(record.pay_now_amount || 0);
  // If "mark paid" is checked and no explicit pay-now amount, treat the entire balance as paid now
  const payNow = markPaid && payNowRaw <= 0 ? Math.max(0, oldBalance) : payNowRaw;
  const finalBalance = markPaid ? 0 : oldBalance - payNow;

  const perDay = totalDays > 0 ? base / totalDays : 0;
  const perDayRounded = Math.round(perDay);
  const present = Number(record.present_days || 0);
  const absent = Number(record.absent_days || 0);
  const off = Number(record.off_days || 0);
  const dutyDays = present + off;
  const earned = Math.round(perDay * dutyDays);

  const monthLabel = `${monthNamesBn[record.month] || record.month} ${bnDigit(record.year)}`;
  const printedOn = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const balLabel = oldBalance >= 0 ? 'এখনও পাওনা' : 'বেশি নিয়েছে';
  const finalBalLabel = finalBalance > 0 ? 'চূড়ান্ত বাকি' : finalBalance < 0 ? 'অতিরিক্ত' : '✓ সম্পূর্ণ পরিশোধিত';

  return `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8">
<title>বেতন কার্ড — ${personName} — ${monthLabel}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Hind Siliguri','Noto Sans Bengali','SolaimanLipi',system-ui,sans-serif;color:#0f172a;background:#f1f5f9}
  .page{max-width:148mm;margin:10px auto;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.08);border-radius:8px;overflow:hidden}
  .hdr{background:linear-gradient(135deg,#16a34a 0%,#15803d 60%,#14532d 100%);color:#fff;padding:9px 14px;display:flex;justify-content:space-between;align-items:flex-start;position:relative}
  .hdr::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,#fbbf24,#f59e0b,#fbbf24)}
  .hdr .brand{font-size:17px;font-weight:800;letter-spacing:.3px;line-height:1.05}
  .hdr .brand-en{font-size:9px;font-weight:500;opacity:.85;letter-spacing:1px;margin-top:2px;text-transform:uppercase}
  .hdr .store-meta{font-size:9px;opacity:.85;margin-top:2px;line-height:1.3}
  .hdr .right{text-align:right}
  .hdr .title{font-size:11px;font-weight:700;letter-spacing:.3px}
  .hdr .month{font-size:14px;font-weight:800;margin-top:2px}
  .hdr .badge{display:inline-block;background:rgba(255,255,255,.22);padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600;margin-top:3px;border:1px solid rgba(255,255,255,.3)}
  .hdr .printed{font-size:8.5px;opacity:.75;margin-top:3px}
  .body{padding:8px 12px 10px}
  .emp{display:flex;justify-content:space-between;align-items:flex-start;padding:6px 10px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:6px;border-left:3px solid #16a34a;margin-bottom:7px}
  .emp .name{font-size:13px;font-weight:800;color:#0f172a;line-height:1.1}
  .emp .meta{font-size:10px;color:#475569;margin-top:2px;line-height:1.3}
  .emp .meta b{color:#0f172a;font-weight:600}
  .emp .code{font-family:'Courier New',monospace;background:#fff;padding:1px 5px;border-radius:3px;font-size:9.5px;font-weight:700;color:#15803d;border:1px solid #bbf7d0}
  .emp .right{text-align:right;font-size:9.5px;color:#475569}
  .emp .right .v{font-size:11px;font-weight:700;color:#0f172a;margin-top:1px}
  .att{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:7px}
  .att .pill{border:1px solid #e2e8f0;border-radius:6px;padding:5px 3px;text-align:center;background:#fff}
  .att .pill .lbl{font-size:9px;color:#64748b;font-weight:500;margin-bottom:2px;text-transform:uppercase;letter-spacing:.2px}
  .att .pill .num{font-size:16px;font-weight:800;line-height:1}
  .att .pill.tot{background:#f8fafc;border-color:#cbd5e1}.att .pill.tot .num{color:#475569}
  .att .pill.prs{background:#f0fdf4;border-color:#bbf7d0}.att .pill.prs .num{color:#15803d}
  .att .pill.abs{background:#fef2f2;border-color:#fecaca}.att .pill.abs .num{color:#dc2626}
  .att .pill.off{background:#fffbeb;border-color:#fde68a}.att .pill.off .num{color:#d97706}
  .ledger{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:7px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
  .ledger thead td{background:#f8fafc;font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;padding:4px 8px;border-bottom:1px solid #e2e8f0}
  .ledger td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .ledger tr:last-child td{border-bottom:none}
  .ledger td.lbl{color:#334155}
  .ledger td.lbl .sub{display:block;font-size:9px;color:#94a3b8;margin-top:1px;font-weight:400}
  .ledger td.val{text-align:right;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
  .pos{color:#15803d}.neg{color:#dc2626}.muted{color:#64748b}
  .ledger tr.sub td{background:#fafbfc}
  .final{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;border-radius:7px;padding:8px 14px;margin:7px 0;box-shadow:0 2px 6px rgba(22,163,74,.2)}
  .final .l{font-size:11px;font-weight:600;letter-spacing:.2px;opacity:.95}
  .final .v{font-size:18px;font-weight:800;letter-spacing:.4px}
  .settle{display:grid;gap:6px;margin-bottom:7px}
  .settle .box{border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;background:#fff}
  .settle .box .l{font-size:8.5px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
  .settle .box .v{font-size:13px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums;line-height:1.1}
  .settle .box .note{font-size:8.5px;color:#6b7280;font-style:italic;margin-top:2px;line-height:1.2}
  .settle .box.paid{background:#f0fdf4;border-color:#bbf7d0}.settle .box.paid .v{color:#15803d}
  .settle .box.bal-pos{background:#fef2f2;border-color:#fecaca}.settle .box.bal-pos .v{color:#dc2626}
  .settle .box.bal-neg{background:#f0fdf4;border-color:#bbf7d0}.settle .box.bal-neg .v{color:#15803d}
  .memo{background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:5px 8px;font-size:9.5px;color:#78350f;margin-bottom:7px;line-height:1.3}
  .memo b{color:#92400e}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:14px}
  .sign .col{text-align:center}
  .sign .col .line{border-top:1.5px solid #94a3b8;padding-top:3px;font-size:10px;color:#475569;font-weight:500}
  .footer{display:flex;justify-content:space-between;align-items:center;padding:5px 12px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:8.5px;color:#94a3b8;margin-top:7px}
  .footer .lbl{font-weight:600;color:#64748b}
  @page{size:A5;margin:4mm}
  @media print{
    body{background:#fff}
    .page{box-shadow:none;border-radius:0;max-width:none;margin:0}
  }
</style></head><body>
<div class="page">

  <div class="hdr">
    <div>
      <div class="brand">${brandNameBn}</div>
      <div class="brand-en">${brandNameEn}</div>
      ${storeAddress ? `<div class="store-meta">📍 ${storeAddress}</div>` : ''}
      ${storePhone ? `<div class="store-meta">📞 ${storePhone}</div>` : ''}
    </div>
    <div class="right">
      <div class="title">🧾 বেতন কার্ড</div>
      <div class="month">${monthLabel}</div>
      ${badgeLabel ? `<div class="badge">${badgeLabel}</div>` : ''}
      <div class="printed">প্রিন্ট: ${printedOn}</div>
    </div>
  </div>

  <div class="body">

    <div class="emp">
      <div>
        <div class="name">${personName}</div>
        <div class="meta">
          ${role ? `<b>${role}</b>` : ''}${role && unitName ? ' · ' : ''}${unitName ? `<b>${unitName}</b>` : ''}
          ${personCode ? `<span class="code" style="margin-left:6px">${personCode}</span>` : ''}
        </div>
      </div>
      <div class="right">
        ${joiningDate ? `<div>যোগদান</div><div class="v">${joiningDate.slice(0, 10)}</div>` : ''}
      </div>
    </div>

    <div class="att">
      <div class="pill tot"><div class="lbl">মোট দিন</div><div class="num">${bnDigit(totalDays)}</div></div>
      <div class="pill prs"><div class="lbl">উপস্থিত</div><div class="num">${bnDigit(present)}</div></div>
      <div class="pill off"><div class="lbl">ছুটি</div><div class="num">${bnDigit(off)}</div></div>
      <div class="pill abs"><div class="lbl">অনুপস্থিত</div><div class="num">${bnDigit(absent)}</div></div>
    </div>

    <table class="ledger">
      <thead>
        <tr><td>হিসাবের বিবরণ</td><td style="text-align:right">টাকা</td></tr>
      </thead>
      <tbody>
        <tr>
          <td class="lbl">মূল মাসিক বেতন <span class="sub">${bnDigit(totalDays)} দিনের জন্য</span></td>
          <td class="val">৳${fmt(base)}</td>
        </tr>
        <tr class="sub">
          <td class="lbl muted">প্রতিদিনের হার <span class="sub">৳${fmt(base)} ÷ ${bnDigit(totalDays)}</span></td>
          <td class="val muted">৳${fmt(perDayRounded)}</td>
        </tr>
        ${dutyDays > 0 ? `<tr>
          <td class="lbl">✅ ${bnDigit(dutyDays)} দিন কাজ <span class="sub">${bnDigit(present)} উপস্থিত${off > 0 ? ` + ${bnDigit(off)} ছুটি` : ''} × ৳${fmt(perDayRounded)}</span></td>
          <td class="val pos">+৳${fmt(earned)}</td>
        </tr>` : ''}
        ${deduction > 0 ? `<tr>
          <td class="lbl">❌ ${bnDigit(absent)} দিন অনুপস্থিত <span class="sub">কর্তন · ${bnDigit(absent)} × ৳${fmt(perDayRounded)}</span></td>
          <td class="val neg">-৳${fmt(deduction)}</td>
        </tr>` : ''}
        ${bonus > 0 ? `<tr>
          <td class="lbl">🎁 বোনাস${record.bonus_note ? ` <span class="sub">${record.bonus_note}</span>` : ''}</td>
          <td class="val pos">+৳${fmt(bonus)}</td>
        </tr>` : ''}
        ${overtime > 0 ? `<tr>
          <td class="lbl">⏱️ ওভারটাইম${record.overtime_note ? ` <span class="sub">${record.overtime_note}</span>` : ''}</td>
          <td class="val pos">+৳${fmt(overtime)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="final">
      <span class="l">চূড়ান্ত প্রাপ্য বেতন</span>
      <span class="v">৳${fmt(finalSalary)}</span>
    </div>

    ${(() => {
      const cols = 2 + (advance > 0 ? 1 : 0) + (payNow > 0 || markPaid ? 2 : 0);
      return `<div class="settle" style="grid-template-columns:repeat(${cols},1fr)">
      <div class="box paid">
        <div class="l">এই মাসে নিয়েছে</div>
        <div class="v">৳${fmt(paid)}</div>
      </div>
      ${advance > 0 ? `<div class="box paid" style="background:#eff6ff;border-color:#bfdbfe">
        <div class="l" style="color:#1d4ed8">🪙 অগ্রিম</div>
        <div class="v" style="color:#1d4ed8">৳${fmt(advance)}</div>
        ${record.advance_note ? `<div class="note">${record.advance_note}</div>` : ''}
      </div>` : ''}
      <div class="box ${oldBalance >= 0 ? 'bal-pos' : 'bal-neg'}">
        <div class="l">${balLabel}</div>
        <div class="v">৳${fmt(Math.abs(oldBalance))}</div>
      </div>
      ${(payNow > 0 || markPaid) ? `<div class="box paid" style="background:#ecfeff;border-color:#a5f3fc">
        <div class="l" style="color:#0e7490">💵 এখন পরিশোধ</div>
        <div class="v" style="color:#0e7490">৳${fmt(payNow)}</div>
        ${record.pay_now_note ? `<div class="note">${record.pay_now_note}</div>` : ''}
      </div>
      <div class="box ${finalBalance > 0 ? 'bal-pos' : 'bal-neg'}">
        <div class="l">${finalBalLabel}</div>
        <div class="v">${finalBalance === 0 ? '—' : '৳' + fmt(Math.abs(finalBalance))}</div>
      </div>` : ''}
    </div>`;
    })()}

    ${record.received_note ? `<div class="memo"><b>📝 মন্তব্য:</b> ${record.received_note}</div>` : ''}

    <div class="sign">
      <div class="col"><div class="line">কর্মচারীর স্বাক্ষর</div></div>
      <div class="col"><div class="line">অনুমোদনকারীর স্বাক্ষর</div></div>
    </div>

  </div>

  <div class="footer">
    <span class="lbl">${brandNameBn} — বেতন সারাংশ</span>
    <span>${brandNameEn} · Salary Statement</span>
  </div>

</div>
<script>setTimeout(()=>window.print(),400);</script>
</body></html>`;
}

export function openSalarySlip(input: SalarySlipInput) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return;
  w.document.write(buildSalarySlipHtml(input));
  w.document.close();
}
