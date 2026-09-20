import prisma from '../../../config/db.js';

const EPS = 0.005;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Parse YYYY-MM-DD (or Date) as a calendar DATE for MySQL @db.Date columns. */
const parseDateOnly = (value, endOfDay = false) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth();
    const d = value.getUTCDate();
    return endOfDay
      ? new Date(Date.UTC(y, m, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    return endOfDay
      ? new Date(Date.UTC(y, m, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  }
  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return parseDateOnly(fallback, endOfDay);
};

/**
 * Fiscal period OR inclusive start/end date filter on journal_entries.entry_date.
 * Period id wins when provided.
 */
const getEntryFilter = (startDate, endDate, periodId) => {
  const filter = {};
  if (periodId) {
    filter.fiscal_period_id = parseInt(periodId, 10);
    return filter;
  }
  if (startDate || endDate) {
    filter.entry_date = {};
    const start = parseDateOnly(startDate, false);
    const end = parseDateOnly(endDate, true);
    if (start) filter.entry_date.gte = start;
    if (end) filter.entry_date.lte = end;
  }
  return filter;
};

const signedBalance = (debit, credit, normalBalance) => {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  return normalBalance === 'credit' ? c - d : d - c;
};

const applyMovement = (opening, debit, credit, normalBalance) => {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  // ASSET/EXPENSE (debit normal): Opening + Debits - Credits
  // LIABILITY/EQUITY/REVENUE (credit normal): Opening + Credits - Debits
  if (normalBalance === 'credit') return opening + c - d;
  return opening + d - c;
};

const SOURCE_LABELS = {
  manual: 'Manual Journal',
  customer_invoice: 'Customer Invoice',
  customer_receipt: 'Customer Receipt',
  vendor_bill: 'Vendor Bill',
  vendor_payment: 'Vendor Payment',
  vendor_refund: 'Vendor Refund',
  pos_order: 'POS Order',
  restaurant_purchase: 'Restaurant Purchase',
  vendor_advance: 'Vendor Advance',
};

const sourceLabel = (sourceType) => SOURCE_LABELS[sourceType] || sourceType || 'Unknown';

/** Find posted entries whose lines do not balance (should never affect reports). */
const findUnbalancedPostedEntryIds = async (companyId, entryFilter = {}) => {
  const entries = await prisma.journal_entries.findMany({
    where: { company_id: companyId, state: 'posted', ...entryFilter },
    select: {
      id: true,
      entry_number: true,
      journal_items: { select: { debit: true, credit: true } },
    },
  });
  const unbalanced = [];
  for (const entry of entries) {
    const totalDebit = entry.journal_items.reduce((s, i) => s + Number(i.debit), 0);
    const totalCredit = entry.journal_items.reduce((s, i) => s + Number(i.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > EPS) {
      unbalanced.push({
        entry_id: entry.id,
        entry_number: entry.entry_number,
        total_debit: round2(totalDebit),
        total_credit: round2(totalCredit),
        difference: round2(totalDebit - totalCredit),
      });
    }
  }
  return unbalanced;
};

const balancedPostedEntryFilter = (companyId, entryFilter, unbalancedIds) => ({
  company_id: companyId,
  state: 'posted',
  ...entryFilter,
  ...(unbalancedIds.length ? { id: { notIn: unbalancedIds } } : {}),
});

const computePnLFromGroups = (result, accounts) => {
  let totalIncome = 0;
  let totalExpense = 0;
  const incomeAccounts = [];
  const expenseAccounts = [];

  for (const item of result) {
    const account = accounts.find((a) => a.id === item.account_id);
    if (!account) continue;
    const debit = Number(item._sum.debit || 0);
    const credit = Number(item._sum.credit || 0);
    const balance = signedBalance(debit, credit, account.account_types.normal_balance);
    const entry = {
      account_id: account.id,
      account_code: account.code,
      account_name: account.name,
      balance: round2(balance),
    };
    if (account.account_types.internal_group === 'income') {
      totalIncome += balance;
      incomeAccounts.push(entry);
    } else if (account.account_types.internal_group === 'expense') {
      totalExpense += balance;
      expenseAccounts.push(entry);
    }
  }

  incomeAccounts.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));
  expenseAccounts.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));

  return {
    income: { total: round2(totalIncome), accounts: incomeAccounts },
    expense: { total: round2(totalExpense), accounts: expenseAccounts },
    net_income: round2(totalIncome - totalExpense),
  };
};

// GET General Ledger
export const getGeneralLedger = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id, account_id, journal_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id, 10);
    const entryFilter = getEntryFilter(start_date, end_date, period_id);
    if (journal_id) entryFilter.journal_id = parseInt(journal_id, 10);

    const unbalanced = await findUnbalancedPostedEntryIds(companyId, entryFilter);
    const unbalancedIds = unbalanced.map((u) => u.entry_id);
    const postedFilter = balancedPostedEntryFilter(companyId, entryFilter, unbalancedIds);

    const lineWhere = {
      journal_entries: postedFilter,
      ...(account_id ? { account_id: parseInt(account_id, 10) } : {}),
    };

    const items = await prisma.journal_items.findMany({
      where: lineWhere,
      orderBy: [
        { chart_of_accounts: { code: 'asc' } },
        { journal_entries: { entry_date: 'asc' } },
        { entry_id: 'asc' },
        { sequence: 'asc' },
        { id: 'asc' },
      ],
      include: {
        journal_entries: {
          select: {
            id: true,
            entry_date: true,
            entry_number: true,
            reference: true,
            narration: true,
            source_type: true,
            journals: { select: { id: true, code: true, name: true } },
          },
        },
        chart_of_accounts: {
          select: {
            id: true,
            code: true,
            name: true,
            account_types: { select: { name: true, internal_group: true, normal_balance: true } },
          },
        },
        currencies: { select: { code: true, symbol: true } },
      },
    });

    // Opening balances (activity before start_date) when using a date range
    const start = !period_id && start_date ? parseDateOnly(start_date, false) : null;
    let openingByAccount = new Map();
    if (start) {
      const openingWhere = {
        journal_entries: {
          company_id: companyId,
          state: 'posted',
          entry_date: { lt: start },
          ...(unbalancedIds.length ? { id: { notIn: unbalancedIds } } : {}),
          ...(journal_id ? { journal_id: parseInt(journal_id, 10) } : {}),
        },
        ...(account_id ? { account_id: parseInt(account_id, 10) } : {}),
      };
      const openingGroups = await prisma.journal_items.groupBy({
        by: ['account_id'],
        where: openingWhere,
        _sum: { debit: true, credit: true },
      });
      openingByAccount = new Map(
        openingGroups.map((row) => [
          row.account_id,
          { debit: Number(row._sum.debit || 0), credit: Number(row._sum.credit || 0) },
        ])
      );
    }

    const byAccount = new Map();
    for (const item of items) {
      const account = item.chart_of_accounts;
      if (!account) continue;
      if (!byAccount.has(account.id)) {
        const openingRaw = openingByAccount.get(account.id) || { debit: 0, credit: 0 };
        const opening = signedBalance(
          openingRaw.debit,
          openingRaw.credit,
          account.account_types?.normal_balance
        );
        byAccount.set(account.id, {
          account_id: account.id,
          account_code: account.code,
          account_name: account.name,
          account_type: account.account_types?.name || account.account_types?.internal_group,
          normal_balance: account.account_types?.normal_balance || 'debit',
          opening_balance: round2(opening),
          total_debit: 0,
          total_credit: 0,
          closing_balance: round2(opening),
          lines: [],
        });
      }
      const group = byAccount.get(account.id);
      const debit = Number(item.debit) || 0;
      const credit = Number(item.credit) || 0;
      group.total_debit += debit;
      group.total_credit += credit;
      group.closing_balance = applyMovement(
        group.closing_balance,
        debit,
        credit,
        group.normal_balance
      );
      const entry = item.journal_entries;
      group.lines.push({
        id: item.id,
        date: entry?.entry_date,
        journal: entry?.journals?.name || null,
        journal_code: entry?.journals?.code || null,
        entry_number: entry?.entry_number,
        reference: entry?.reference || null,
        source: sourceLabel(entry?.source_type),
        source_type: entry?.source_type,
        description: item.label || entry?.narration || null,
        debit: round2(debit),
        credit: round2(credit),
        running_balance: round2(group.closing_balance),
        currency: item.currencies?.code || null,
      });
    }

    // Include accounts that only have an opening balance (no period activity) when filtered to one account
    if (account_id && !byAccount.has(parseInt(account_id, 10))) {
      const account = await prisma.chart_of_accounts.findFirst({
        where: { id: parseInt(account_id, 10), company_id: companyId },
        select: {
          id: true,
          code: true,
          name: true,
          account_types: { select: { name: true, internal_group: true, normal_balance: true } },
        },
      });
      if (account) {
        const openingRaw = openingByAccount.get(account.id) || { debit: 0, credit: 0 };
        const opening = signedBalance(
          openingRaw.debit,
          openingRaw.credit,
          account.account_types?.normal_balance
        );
        byAccount.set(account.id, {
          account_id: account.id,
          account_code: account.code,
          account_name: account.name,
          account_type: account.account_types?.name || account.account_types?.internal_group,
          normal_balance: account.account_types?.normal_balance || 'debit',
          opening_balance: round2(opening),
          total_debit: 0,
          total_credit: 0,
          closing_balance: round2(opening),
          lines: [],
        });
      }
    }

    const accounts = [...byAccount.values()].sort((a, b) =>
      String(a.account_code).localeCompare(String(b.account_code))
    );
    for (const account of accounts) {
      account.total_debit = round2(account.total_debit);
      account.total_credit = round2(account.total_credit);
      account.closing_balance = round2(account.closing_balance);
    }

    const totals = accounts.reduce(
      (acc, row) => {
        acc.debit += row.total_debit;
        acc.credit += row.total_credit;
        return acc;
      },
      { debit: 0, credit: 0 }
    );

    const warnings = [];
    if (unbalanced.length) {
      warnings.push({
        code: 'UNBALANCED_ENTRIES_EXCLUDED',
        message: `${unbalanced.length} unbalanced posted journal entry(ies) were excluded from this report.`,
        entries: unbalanced,
      });
    }

    // Flat lines kept for backward-compatible CSV clients that expect the old shape
    const flat_lines = accounts.flatMap((account) =>
      account.lines.map((line) => ({
        id: line.id,
        debit: line.debit,
        credit: line.credit,
        label: line.description,
        running_balance: line.running_balance,
        journal_entries: {
          id: null,
          entry_date: line.date,
          entry_number: line.entry_number,
          reference: line.reference,
          narration: line.description,
        },
        chart_of_accounts: {
          code: account.account_code,
          name: account.account_name,
          account_types: { normal_balance: account.normal_balance },
        },
      }))
    );

    res.status(200).json({
      success: true,
      count: flat_lines.length,
      data: {
        accounts,
        totals: { debit: round2(totals.debit), credit: round2(totals.credit) },
        warnings,
        // legacy flat array also exposed for older UI paths
        lines: flat_lines,
      },
    });
  } catch (error) {
    console.error('General Ledger Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Trial Balance
export const getTrialBalance = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id, 10);
    const entryFilter = getEntryFilter(start_date, end_date, period_id);

    const unbalanced = await findUnbalancedPostedEntryIds(companyId, entryFilter);
    const unbalancedIds = unbalanced.map((u) => u.entry_id);
    const postedFilter = balancedPostedEntryFilter(companyId, entryFilter, unbalancedIds);

    const where = { journal_entries: postedFilter };
    const result = await prisma.journal_items.groupBy({
      by: ['account_id'],
      where,
      _sum: { debit: true, credit: true },
    });

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: result.map((r) => r.account_id) }, company_id: companyId },
      select: {
        id: true,
        code: true,
        name: true,
        allow_manual_entry: true,
        account_types: { select: { name: true, internal_group: true, normal_balance: true } },
      },
    });

    const data = result
      .map((item) => {
        const account = accounts.find((a) => a.id === item.account_id);
        if (!account) return null;
        const debit = Number(item._sum.debit || 0);
        const credit = Number(item._sum.credit || 0);
        const rawNet = debit - credit; // classical TB uses raw net, not signed by normal balance
        const balance = signedBalance(debit, credit, account.account_types?.normal_balance);
        const debitBalance = rawNet > EPS ? round2(rawNet) : 0;
        const creditBalance = rawNet < -EPS ? round2(Math.abs(rawNet)) : 0;
        return {
          account_id: item.account_id,
          account_code: account.code,
          account_name: account.name,
          account_type: account.account_types?.name || account.account_types?.internal_group,
          normal_balance: account.account_types?.normal_balance,
          total_debit: round2(debit),
          total_credit: round2(credit),
          debit: debitBalance,
          credit: creditBalance,
          balance: round2(balance),
        };
      })
      .filter(Boolean)
      .filter((row) => Math.abs(row.debit) > EPS || Math.abs(row.credit) > EPS)
      .sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));

    const totalDebit = round2(data.reduce((s, r) => s + r.debit, 0));
    const totalCredit = round2(data.reduce((s, r) => s + r.credit, 0));
    const difference = round2(totalDebit - totalCredit);
    const isBalanced = Math.abs(difference) <= EPS;

    const warnings = [];
    if (unbalanced.length) {
      warnings.push({
        code: 'UNBALANCED_ENTRIES_EXCLUDED',
        message: `${unbalanced.length} unbalanced posted journal entry(ies) were excluded.`,
        entries: unbalanced,
      });
    }
    if (!isBalanced) {
      warnings.push({
        code: 'TRIAL_BALANCE_IMBALANCE',
        message: `Trial Balance is out of balance by ${difference}. Total Debit ${totalDebit} ≠ Total Credit ${totalCredit}.`,
        difference,
        total_debit: totalDebit,
        total_credit: totalCredit,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        accounts: data,
        totals: { debit: totalDebit, credit: totalCredit, difference },
        is_balanced: isBalanced,
        warnings,
      },
    });
  } catch (error) {
    console.error('Trial Balance Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Profit and Loss (Income Statement)
export const getProfitAndLoss = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id, 10);
    const entryFilter = getEntryFilter(start_date, end_date, period_id);

    const unbalanced = await findUnbalancedPostedEntryIds(companyId, entryFilter);
    const unbalancedIds = unbalanced.map((u) => u.entry_id);
    const postedFilter = balancedPostedEntryFilter(companyId, entryFilter, unbalancedIds);

    const where = {
      journal_entries: postedFilter,
      chart_of_accounts: {
        company_id: companyId,
        account_types: { internal_group: { in: ['income', 'expense'] } },
      },
    };
    const result = await prisma.journal_items.groupBy({
      by: ['account_id'],
      where,
      _sum: { debit: true, credit: true },
    });

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: result.map((r) => r.account_id) }, company_id: companyId },
      select: {
        id: true,
        code: true,
        name: true,
        account_types: { select: { internal_group: true, normal_balance: true } },
      },
    });

    const pnl = computePnLFromGroups(result, accounts);
    const warnings = [];
    if (unbalanced.length) {
      warnings.push({
        code: 'UNBALANCED_ENTRIES_EXCLUDED',
        message: `${unbalanced.length} unbalanced posted journal entry(ies) were excluded.`,
        entries: unbalanced,
      });
    }

    res.status(200).json({
      success: true,
      data: { ...pnl, warnings },
    });
  } catch (error) {
    console.error('P&L Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Cash Flow — direct method on reconcilable cash/bank/mobile-money GL accounts
export const getCashFlow = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id, 10);
    const entryFilter = getEntryFilter(start_date, end_date, period_id);

    // Liquidity = Cash / Bank / Mobile Money only (never AR/AP even if reconcilable).
    // Codes: 111x Cash, 1121–1129 Banks, 1131–1139 Mobile Money.
    const isCashLikeCode = (code) => /^111\d*|^112[1-9]\d*|^113[1-9]\d*$/.test(String(code || ''));

    const [cashLikeAccounts, bankAccounts, paymentMethods] = await Promise.all([
      prisma.chart_of_accounts.findMany({
        where: {
          company_id: companyId,
          is_active: true,
          allow_manual_entry: true,
          account_types: { internal_group: 'asset' },
        },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
      prisma.bank_accounts.findMany({
        where: { company_id: companyId, is_active: true, gl_account_id: { not: null } },
        select: {
          id: true,
          account_name: true,
          account_number: true,
          gl_account_id: true,
          currencies: { select: { code: true } },
        },
      }),
      prisma.payment_methods.findMany({
        where: { is_active: true, gl_account_id: { not: null } },
        select: {
          id: true,
          name: true,
          gl_account_id: true,
          chart_of_accounts: { select: { id: true, code: true, name: true, company_id: true } },
        },
      }),
    ]);

    const companyPMs = paymentMethods.filter(
      (pm) => pm.chart_of_accounts?.company_id === companyId && isCashLikeCode(pm.chart_of_accounts?.code)
    );
    const liquidityMap = new Map();
    for (const account of cashLikeAccounts.filter((a) => isCashLikeCode(a.code))) {
      liquidityMap.set(account.id, {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        account_number: null,
        bank_account_id: null,
        currency: null,
      });
    }
    for (const bank of bankAccounts) {
      const existing = liquidityMap.get(bank.gl_account_id) || {
        account_id: bank.gl_account_id,
        account_code: null,
        account_name: bank.account_name,
        account_number: null,
        bank_account_id: null,
        currency: null,
      };
      existing.bank_account_id = bank.id;
      existing.account_name = bank.account_name;
      existing.account_number = bank.account_number;
      existing.currency = bank.currencies?.code || null;
      liquidityMap.set(bank.gl_account_id, existing);
    }
    for (const pm of companyPMs) {
      if (!liquidityMap.has(pm.gl_account_id)) {
        liquidityMap.set(pm.gl_account_id, {
          account_id: pm.gl_account_id,
          account_code: pm.chart_of_accounts?.code || null,
          account_name: pm.chart_of_accounts?.name || pm.name,
          account_number: null,
          bank_account_id: null,
          currency: null,
        });
      }
    }

    // Fill missing codes/names from CoA, then drop anything that is not cash-like
    const missingIds = [...liquidityMap.values()]
      .filter((row) => !row.account_code)
      .map((row) => row.account_id);
    if (missingIds.length) {
      const extras = await prisma.chart_of_accounts.findMany({
        where: { id: { in: missingIds }, company_id: companyId },
        select: { id: true, code: true, name: true },
      });
      for (const account of extras) {
        const row = liquidityMap.get(account.id);
        if (!row) continue;
        row.account_code = account.code;
        if (!row.account_name) row.account_name = account.name;
      }
    }
    for (const [id, row] of [...liquidityMap.entries()]) {
      if (!isCashLikeCode(row.account_code)) liquidityMap.delete(id);
    }

    const accountIds = [...liquidityMap.keys()];
    if (!accountIds.length) {
      return res.json({
        success: true,
        data: {
          accounts: [],
          opening_balance: 0,
          inflows: 0,
          outflows: 0,
          net_change: 0,
          closing_balance: 0,
          activities: { operating: 0, investing: 0, financing: 0 },
          warnings: [{ code: 'NO_LIQUIDITY_ACCOUNTS', message: 'No cash/bank/mobile-money GL accounts were found.' }],
        },
      });
    }

    const unbalanced = await findUnbalancedPostedEntryIds(companyId, entryFilter);
    const unbalancedIds = unbalanced.map((u) => u.entry_id);
    const postedFilter = balancedPostedEntryFilter(companyId, entryFilter, unbalancedIds);

    const periodWhere = { account_id: { in: accountIds }, journal_entries: postedFilter };
    const start = !period_id && start_date ? parseDateOnly(start_date, false) : null;

    const [periodGroups, openingGroups, periodLines] = await Promise.all([
      prisma.journal_items.groupBy({
        by: ['account_id'],
        where: periodWhere,
        _sum: { debit: true, credit: true },
      }),
      start
        ? prisma.journal_items.groupBy({
            by: ['account_id'],
            where: {
              account_id: { in: accountIds },
              journal_entries: {
                company_id: companyId,
                state: 'posted',
                entry_date: { lt: start },
                ...(unbalancedIds.length ? { id: { notIn: unbalancedIds } } : {}),
              },
            },
            _sum: { debit: true, credit: true },
          })
        : Promise.resolve([]),
      // Lines needed to classify operating / investing / financing by counterparty type
      prisma.journal_items.findMany({
        where: periodWhere,
        select: {
          account_id: true,
          debit: true,
          credit: true,
          entry_id: true,
          journal_entries: {
            select: {
              source_type: true,
              journal_items: {
                select: {
                  account_id: true,
                  debit: true,
                  credit: true,
                  chart_of_accounts: {
                    select: { account_types: { select: { internal_group: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    let openingBalance = 0;
    let inflows = 0;
    let outflows = 0;
    const accounts = [...liquidityMap.values()]
      .sort((a, b) => String(a.account_code || '').localeCompare(String(b.account_code || '')))
      .map((meta) => {
        const period = periodGroups.find((row) => row.account_id === meta.account_id);
        const opening = openingGroups.find((row) => row.account_id === meta.account_id);
        const openingAmount = Number(opening?._sum.debit || 0) - Number(opening?._sum.credit || 0);
        const received = Number(period?._sum.debit || 0);
        const paid = Number(period?._sum.credit || 0);
        openingBalance += openingAmount;
        inflows += received;
        outflows += paid;
        return {
          account_id: meta.account_id,
          account_code: meta.account_code,
          account_name: meta.account_name,
          account_number: meta.account_number,
          bank_account_id: meta.bank_account_id,
          currency: meta.currency,
          opening_balance: round2(openingAmount),
          inflows: round2(received),
          outflows: round2(paid),
          net_change: round2(received - paid),
          closing_balance: round2(openingAmount + received - paid),
        };
      })
      .filter(
        (row) =>
          Math.abs(row.opening_balance) > EPS ||
          Math.abs(row.inflows) > EPS ||
          Math.abs(row.outflows) > EPS ||
          Math.abs(row.closing_balance) > EPS
      );

    // Classify net cash movement by JE source / counterparty account group
    let operating = 0;
    let investing = 0;
    let financing = 0;
    const seenLine = new Set();
    for (const line of periodLines) {
      const key = `${line.entry_id}:${line.account_id}:${line.debit}:${line.credit}`;
      if (seenLine.has(key)) continue;
      seenLine.add(key);
      const netCash = Number(line.debit) - Number(line.credit); // + inflow, - outflow
      if (Math.abs(netCash) <= EPS) continue;

      const source = line.journal_entries?.source_type;
      let bucket = 'operating';
      if (source === 'manual') {
        const counterparts = (line.journal_entries?.journal_items || []).filter(
          (other) => other.account_id !== line.account_id
        );
        const groups = counterparts.map((c) => c.chart_of_accounts?.account_types?.internal_group);
        if (groups.some((g) => g === 'equity')) bucket = 'financing';
        else if (groups.some((g) => g === 'asset') && !groups.every((g) => g === 'asset')) {
          // Asset↔asset transfers (e.g. cash to bank) stay operating; equity manuals = financing
          bucket = 'operating';
        } else if (groups.some((g) => g === 'asset')) {
          // Pure asset transfer between liquidity accounts cancels in totals; leave operating
          bucket = 'operating';
        }
      } else if (['customer_receipt', 'vendor_payment', 'vendor_refund', 'vendor_bill', 'customer_invoice', 'pos_order', 'restaurant_purchase'].includes(source)) {
        bucket = 'operating';
      } else if (source === 'vendor_advance') {
        bucket = 'operating';
      }

      if (bucket === 'operating') operating += netCash;
      else if (bucket === 'investing') investing += netCash;
      else financing += netCash;
    }

    const warnings = [];
    if (unbalanced.length) {
      warnings.push({
        code: 'UNBALANCED_ENTRIES_EXCLUDED',
        message: `${unbalanced.length} unbalanced posted journal entry(ies) were excluded.`,
        entries: unbalanced,
      });
    }

    res.json({
      success: true,
      data: {
        accounts,
        opening_balance: round2(openingBalance),
        inflows: round2(inflows),
        outflows: round2(outflows),
        net_change: round2(inflows - outflows),
        closing_balance: round2(openingBalance + inflows - outflows),
        activities: {
          operating: round2(operating),
          investing: round2(investing),
          financing: round2(financing),
        },
        warnings,
      },
    });
  } catch (error) {
    console.error('Cash Flow Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Journal Report
export const getJournalReport = async (req, res) => {
  try {
    const { company_id, start_date, end_date, period_id, journal_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id, 10);
    const entryFilter = getEntryFilter(start_date, end_date, period_id);
    const where = {
      company_id: companyId,
      state: 'posted',
      ...entryFilter,
      ...(journal_id ? { journal_id: parseInt(journal_id, 10) } : {}),
    };

    const entries = await prisma.journal_entries.findMany({
      where,
      orderBy: [{ entry_date: 'asc' }, { id: 'asc' }],
      include: {
        journals: { select: { id: true, code: true, name: true, journal_type: true } },
        journal_items: {
          orderBy: { sequence: 'asc' },
          include: { chart_of_accounts: { select: { code: true, name: true } } },
        },
      },
    });

    const data = entries.map((entry) => {
      const totalDebit = entry.journal_items.reduce((sum, line) => sum + Number(line.debit), 0);
      const totalCredit = entry.journal_items.reduce((sum, line) => sum + Number(line.credit), 0);
      const difference = round2(totalDebit - totalCredit);
      return {
        id: entry.id,
        entry_number: entry.entry_number,
        entry_date: entry.entry_date,
        reference: entry.reference,
        narration: entry.narration,
        state: entry.state,
        source_type: entry.source_type,
        source: sourceLabel(entry.source_type),
        journals: entry.journals,
        journal_items: entry.journal_items,
        total_debit: round2(totalDebit),
        total_credit: round2(totalCredit),
        is_balanced: Math.abs(difference) <= EPS,
        difference,
      };
    });

    const unbalanced = data.filter((row) => !row.is_balanced);
    const warnings = unbalanced.length
      ? [
          {
            code: 'UNBALANCED_JOURNAL_ENTRIES',
            message: `${unbalanced.length} posted journal entry(ies) do not balance.`,
            entries: unbalanced.map((row) => ({
              entry_id: row.id,
              entry_number: row.entry_number,
              total_debit: row.total_debit,
              total_credit: row.total_credit,
              difference: row.difference,
            })),
          },
        ]
      : [];

    res.json({ success: true, data: { entries: data, warnings } });
  } catch (error) {
    console.error('Journal Report Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Balance Sheet
export const getBalanceSheet = async (req, res) => {
  try {
    const { company_id, as_of_date } = req.query;
    if (!company_id) return res.status(400).json({ success: false, message: 'company_id is required' });
    const companyId = parseInt(company_id, 10);
    const dateFilter = as_of_date ? parseDateOnly(as_of_date, true) : parseDateOnly(new Date(), true);

    const entryDateFilter = dateFilter ? { entry_date: { lte: dateFilter } } : {};
    const unbalanced = await findUnbalancedPostedEntryIds(companyId, entryDateFilter);
    const unbalancedIds = unbalanced.map((u) => u.entry_id);
    const postedFilter = {
      company_id: companyId,
      state: 'posted',
      ...entryDateFilter,
      ...(unbalancedIds.length ? { id: { notIn: unbalancedIds } } : {}),
    };

    const [bsResult, plResult] = await Promise.all([
      prisma.journal_items.groupBy({
        by: ['account_id'],
        where: {
          journal_entries: postedFilter,
          chart_of_accounts: {
            company_id: companyId,
            account_types: { internal_group: { in: ['asset', 'liability', 'equity'] } },
          },
        },
        _sum: { debit: true, credit: true },
      }),
      prisma.journal_items.groupBy({
        by: ['account_id'],
        where: {
          journal_entries: postedFilter,
          chart_of_accounts: {
            company_id: companyId,
            account_types: { internal_group: { in: ['income', 'expense'] } },
          },
        },
        _sum: { debit: true, credit: true },
      }),
    ]);

    const accountIds = [...new Set([...bsResult, ...plResult].map((r) => r.account_id))];
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: accountIds }, company_id: companyId },
      select: {
        id: true,
        code: true,
        name: true,
        account_types: { select: { internal_group: true, normal_balance: true, name: true } },
      },
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    const assets = [];
    const liabilities = [];
    const equity = [];

    for (const item of bsResult) {
      const account = accounts.find((a) => a.id === item.account_id);
      if (!account) continue;
      const debit = Number(item._sum.debit || 0);
      const credit = Number(item._sum.credit || 0);
      const balance = signedBalance(debit, credit, account.account_types.normal_balance);
      if (Math.abs(balance) <= EPS) continue;
      const entry = {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        balance: round2(balance),
      };
      if (account.account_types.internal_group === 'asset') {
        totalAssets += balance;
        assets.push(entry);
      } else if (account.account_types.internal_group === 'liability') {
        totalLiabilities += balance;
        liabilities.push(entry);
      } else if (account.account_types.internal_group === 'equity') {
        totalEquity += balance;
        equity.push(entry);
      }
    }

    // Current-year (to date) net income rolled into equity — avoids double-count if already closed to RE
    const pnlAccounts = accounts.filter((a) =>
      ['income', 'expense'].includes(a.account_types?.internal_group)
    );
    const pnl = computePnLFromGroups(plResult, pnlAccounts);
    const currentEarnings = pnl.net_income;
    if (Math.abs(currentEarnings) > EPS) {
      equity.push({
        account_id: null,
        account_code: 'CYE',
        account_name: 'Current Year Earnings',
        balance: round2(currentEarnings),
        is_derived: true,
      });
      totalEquity += currentEarnings;
    }

    assets.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));
    liabilities.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));
    equity.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));

    totalAssets = round2(totalAssets);
    totalLiabilities = round2(totalLiabilities);
    totalEquity = round2(totalEquity);
    const equationDifference = round2(totalAssets - (totalLiabilities + totalEquity));
    const isBalanced = Math.abs(equationDifference) <= EPS;

    const warnings = [];
    if (unbalanced.length) {
      warnings.push({
        code: 'UNBALANCED_ENTRIES_EXCLUDED',
        message: `${unbalanced.length} unbalanced posted journal entry(ies) were excluded.`,
        entries: unbalanced,
      });
    }
    if (!isBalanced) {
      warnings.push({
        code: 'BALANCE_SHEET_IMBALANCE',
        message: `Accounting equation failed: Assets (${totalAssets}) ≠ Liabilities (${totalLiabilities}) + Equity (${totalEquity}). Difference: ${equationDifference}.`,
        difference: equationDifference,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        current_year_earnings: round2(currentEarnings),
      });
    }

    res.status(200).json({
      success: true,
      data: {
        as_of_date: dateFilter,
        assets: { total: totalAssets, accounts: assets },
        liabilities: { total: totalLiabilities, accounts: liabilities },
        equity: { total: totalEquity, accounts: equity },
        current_year_earnings: round2(currentEarnings),
        equation: {
          assets: totalAssets,
          liabilities_plus_equity: round2(totalLiabilities + totalEquity),
          difference: equationDifference,
          is_balanced: isBalanced,
        },
        warnings,
      },
    });
  } catch (error) {
    console.error('Balance Sheet Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
