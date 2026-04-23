/**
 * 4626 Outreach — Google Sheets setup script.
 *
 * One-time transformation of the master-outreach-sheet-*.csv import into a
 * work-ready CRM view: frozen header, hidden payload columns, heatmap-style
 * conditional formatting, 5 filter views over the same rows, and a
 * Dashboard tab with live summary stats.
 *
 * How to use:
 *   1. Import the CSV into a new Google Sheet (File → Import → Upload).
 *   2. Extensions → Apps Script. Paste this entire file, replace the empty
 *      default Code.gs content.
 *   3. In the left sidebar: Services → + → search for "Google Sheets API" →
 *      Add. (The filter-view creation step needs this.)
 *   4. Save. Select the `setupOutreachSheet` function from the function
 *      picker at the top. Click Run.
 *   5. Authorize the script when prompted (first-run only).
 *
 * Safe to run more than once. The script clears and re-applies its own
 * conditional-format rules and filter views, so re-running gives you a
 * clean state instead of duplicates.
 */

// Columns hidden by default because they're 0x-address or CDN-URL payloads
// that rarely need to be read; they remain filter/query-able.
const HIDDEN_BY_DEFAULT = [
  "Avatar URL",
  "Install Target URL",
  "Signing EOA URL",
  "Zora Profile URL",
  "CSW Address",
  "Holder Address",
  "Install Target",
  "Signing EOA",
  "XMTP Address",
];

// Filter-view definitions. Each one is a saved lens over the same rows so
// nothing is duplicated. Sort order and column filters are both set.
const FILTER_VIEWS = [
  {
    title: "1. Outreach Queue",
    description: "Reachable + not yet contacted. Your daily action list.",
    filters: [
      { column: "XMTP Reachable", type: "BOOLEAN_IS_TRUE" },
      { column: "Status", type: "TEXT_EQ", value: "Not contacted" },
    ],
    sorts: [
      { column: "Priority", direction: "ASCENDING" },
      { column: "Unique Holders", direction: "DESCENDING" },
    ],
  },
  {
    title: "2. Hot Leads",
    description: "Reachable AND signer has gas on Base — one-signature install.",
    filters: [
      { column: "XMTP Reachable", type: "BOOLEAN_IS_TRUE" },
      { column: "Install Readiness", type: "TEXT_EQ", value: "ready" },
    ],
    sorts: [
      { column: "Market Cap USD", direction: "DESCENDING" },
    ],
  },
  {
    title: "3. Needs Gas Sponsorship",
    description: "Reachable but signer has no Base ETH. Different CTA.",
    filters: [
      { column: "XMTP Reachable", type: "BOOLEAN_IS_TRUE" },
      { column: "Install Readiness", type: "TEXT_EQ", value: "needs_gas" },
    ],
    sorts: [
      { column: "Unique Holders", direction: "DESCENDING" },
    ],
  },
  {
    title: "4. Off-network P0s",
    description: "Can't reach via Base App — use Twitter / Farcaster instead.",
    filters: [
      { column: "XMTP Reachable", type: "BOOLEAN_IS_FALSE" },
      { column: "Priority", type: "TEXT_EQ", value: "P0" },
    ],
    sorts: [
      { column: "Unique Holders", direction: "DESCENDING" },
    ],
  },
  {
    title: "5. Multi-Believers",
    description: "Holders of 3+ creator coins — recruit as advocates.",
    filters: [
      { column: "Cohort", type: "TEXT_EQ", value: "multi_holder" },
    ],
    sorts: [
      { column: "Creators Held", direction: "DESCENDING" },
    ],
  },
];

function setupOutreachSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];

  if (sheet.getName() === "Sheet1") {
    sheet.setName("Creators");
  }

  const headers = headerIndexMap(sheet);
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  console.log(`Configuring sheet "${sheet.getName()}" (${lastRow} rows × ${lastCol} cols)`);

  // 1. Freeze header row + first 5 columns (Name, Cohort, Status, Priority,
  //    Zora Handle). Those are the columns you always want on screen as you
  //    scroll right.
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(5);

  // 2. Bold + background the header row so filters/sorts are unambiguous.
  sheet
    .getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setBackground("#1f1f1f")
    .setFontColor("#ffffff");

  // 3. Convert the "XMTP Reachable" string column ("true"/"false") to real
  //    boolean checkboxes. Filter views can then use BOOLEAN_IS_TRUE which
  //    is cleaner than TEXT_EQ "true".
  convertTextColumnToCheckboxes(sheet, headers, "XMTP Reachable", lastRow);

  // 4. Hide payload columns by default.
  for (const name of HIDDEN_BY_DEFAULT) {
    const idx = headers.get(name);
    if (idx != null) sheet.hideColumns(idx + 1);
  }

  // 5. Conditional formatting: turn the sheet into a heatmap.
  applyConditionalFormatting(sheet, headers, lastRow);

  // 6. Widths: shrink address-shaped columns, widen name-shaped columns.
  widenColumn(sheet, headers, "Name", 260);
  widenColumn(sheet, headers, "Coin Ticker", 180);
  widenColumn(sheet, headers, "Zora Handle", 150);
  widenColumn(sheet, headers, "Outreach Copy", 400);

  // 7. Filter views via Advanced Sheets API.
  if (typeof Sheets === "undefined") {
    console.warn(
      "Google Sheets API advanced service is not enabled — skipping filter views. " +
        "Enable it via Services → + → Google Sheets API and re-run.",
    );
  } else {
    applyFilterViews(ss, sheet, headers, lastRow, lastCol);
  }

  // 8. Dashboard tab with live summary stats.
  buildDashboard(ss, sheet.getName());

  console.log("Done. Open the filter-view picker (funnel icon) to switch lenses.");
}

function headerIndexMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = new Map();
  for (let i = 0; i < headerRow.length; i += 1) {
    const name = String(headerRow[i]).trim();
    if (name) map.set(name, i); // 0-indexed
  }
  return map;
}

function convertTextColumnToCheckboxes(sheet, headers, columnName, lastRow) {
  const idx = headers.get(columnName);
  if (idx == null || lastRow < 2) return;
  const range = sheet.getRange(2, idx + 1, lastRow - 1, 1);
  const values = range.getValues();
  const booleanValues = values.map((row) => {
    const v = String(row[0]).toLowerCase();
    return [v === "true"];
  });
  range.setValues(booleanValues);
  range.insertCheckboxes();
}

function widenColumn(sheet, headers, name, pixels) {
  const idx = headers.get(name);
  if (idx != null) sheet.setColumnWidth(idx + 1, pixels);
}

function applyConditionalFormatting(sheet, headers, lastRow) {
  if (lastRow < 2) return;
  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const rules = [];

  const textEq = (col, value, bg, fg, bold) => {
    const idx = headers.get(col);
    if (idx == null) return null;
    const range = sheet.getRange(2, idx + 1, lastRow - 1, 1);
    let b = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(value)
      .setRanges([range]);
    if (bg) b = b.setBackground(bg);
    if (fg) b = b.setFontColor(fg);
    if (bold) b = b.setBold(true);
    return b.build();
  };

  const boolIsTrue = (col, fg) => {
    const idx = headers.get(col);
    if (idx == null) return null;
    const range = sheet.getRange(2, idx + 1, lastRow - 1, 1);
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=INDIRECT(ADDRESS(ROW(), ${idx + 1}))=TRUE`)
      .setRanges([range])
      .setFontColor(fg)
      .build();
  };

  const boolIsFalse = (col, fg) => {
    const idx = headers.get(col);
    if (idx == null) return null;
    const range = sheet.getRange(2, idx + 1, lastRow - 1, 1);
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=INDIRECT(ADDRESS(ROW(), ${idx + 1}))=FALSE`)
      .setRanges([range])
      .setFontColor(fg)
      .build();
  };

  // Priority heatmap
  rules.push(textEq("Priority", "P0", "#d93025", "#ffffff", true));
  rules.push(textEq("Priority", "P1", "#e8710a", "#ffffff"));
  rules.push(textEq("Priority", "P2", "#f9ab00", "#1f1f1f"));
  rules.push(textEq("Priority", "P3", "#e0e0e0", "#5f6368"));

  // XMTP reachability
  rules.push(boolIsTrue("XMTP Reachable", "#188038"));
  rules.push(boolIsFalse("XMTP Reachable", "#9e9e9e"));

  // Install readiness
  rules.push(textEq("Install Readiness", "ready", "#e6f4ea"));
  rules.push(textEq("Install Readiness", "needs_gas", "#fef7e0"));
  rules.push(textEq("Install Readiness", "unknown", "#f1f3f4", "#5f6368"));

  // Status funnel
  rules.push(textEq("Status", "Installed", "#0d652d", "#ffffff", true));
  rules.push(textEq("Status", "Responded", "#185abc", "#ffffff"));
  rules.push(textEq("Status", "Reached out", "#e8710a", "#ffffff"));
  rules.push(textEq("Status", "No interest", "#fce8e6", "#5f6368"));
  rules.push(textEq("Status", "Bad fit", "#f3e8fd", "#5f6368"));

  // Cohort tagging (subtle)
  rules.push(textEq("Cohort", "top_creator", "#e8f0fe"));
  rules.push(textEq("Cohort", "extension_wallet", "#e6f4ea"));
  rules.push(textEq("Cohort", "multi_holder", "#f3e8fd"));

  // Market-cap color scale
  const mcIdx = headers.get("Market Cap USD");
  if (mcIdx != null) {
    const mcRange = sheet.getRange(2, mcIdx + 1, lastRow - 1, 1);
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .setRanges([mcRange])
        .setGradientMinpointWithValue("#ffffff", SpreadsheetApp.InterpolationType.NUMBER, "0")
        .setGradientMaxpointWithValue("#188038", SpreadsheetApp.InterpolationType.PERCENTILE, "95")
        .build(),
    );
  }

  sheet.setConditionalFormatRules(rules.filter(Boolean));
}

function applyFilterViews(ss, sheet, headers, lastRow, lastCol) {
  const spreadsheetId = ss.getId();
  const sheetId = sheet.getSheetId();

  // Clear any filter views we own from previous runs so we don't duplicate.
  const existing = Sheets.Spreadsheets.get(spreadsheetId, {
    fields: "sheets(properties(sheetId),filterViews(filterViewId,title))",
  });
  const deletes = [];
  for (const s of existing.sheets ?? []) {
    for (const fv of s.filterViews ?? []) {
      if ((fv.title ?? "").match(/^\d+\. /)) {
        deletes.push({ deleteFilterView: { filterId: fv.filterViewId } });
      }
    }
  }
  if (deletes.length) {
    Sheets.Spreadsheets.batchUpdate({ requests: deletes }, spreadsheetId);
  }

  const adds = FILTER_VIEWS.map((fv) => {
    const criteria = {};
    for (const f of fv.filters) {
      const idx = headers.get(f.column);
      if (idx == null) continue;
      if (f.type === "BOOLEAN_IS_TRUE") {
        criteria[idx] = {
          condition: {
            type: "TEXT_EQ",
            values: [{ userEnteredValue: "TRUE" }],
          },
        };
      } else if (f.type === "BOOLEAN_IS_FALSE") {
        criteria[idx] = {
          condition: {
            type: "TEXT_EQ",
            values: [{ userEnteredValue: "FALSE" }],
          },
        };
      } else if (f.type === "TEXT_EQ") {
        criteria[idx] = {
          condition: {
            type: "TEXT_EQ",
            values: [{ userEnteredValue: f.value }],
          },
        };
      }
    }

    const sortSpecs = fv.sorts
      .map((s) => {
        const idx = headers.get(s.column);
        if (idx == null) return null;
        return { dimensionIndex: idx, sortOrder: s.direction };
      })
      .filter(Boolean);

    return {
      addFilterView: {
        filter: {
          title: fv.title,
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: lastRow,
            startColumnIndex: 0,
            endColumnIndex: lastCol,
          },
          criteria,
          sortSpecs,
        },
      },
    };
  });

  Sheets.Spreadsheets.batchUpdate({ requests: adds }, spreadsheetId);
}

// Dashboard color palette (Google Material + Base blue).
const DASH_COLORS = {
  bgPage: "#fafafa",
  accent: "#1a73e8",
  success: "#188038",
  warning: "#e8710a",
  danger: "#d93025",
  neutral: "#5f6368",
  divider: "#1f1f1f",
  cardBg: "#ffffff",
  cardBorder: "#e0e0e0",
  tableHeader: "#1f1f1f",
  tableHeaderText: "#ffffff",
  sectionBg: "#e8f0fe",
};

function buildDashboard(ss, sourceSheetName) {
  let dash = ss.getSheetByName("📊 Dashboard");
  if (dash) ss.deleteSheet(dash);
  dash = ss.insertSheet("📊 Dashboard", 1);

  // Resolve column letters once, by name, so the dashboard survives column
  // reorders in the Creators sheet.
  const col = {
    name: colLetter("Name", ss, sourceSheetName),
    cohort: colLetter("Cohort", ss, sourceSheetName),
    status: colLetter("Status", ss, sourceSheetName),
    priority: colLetter("Priority", ss, sourceSheetName),
    readiness: colLetter("Install Readiness", ss, sourceSheetName),
    reachable: colLetter("XMTP Reachable", ss, sourceSheetName),
    xmtpKind: colLetter("XMTP Address Kind", ss, sourceSheetName),
  };

  const q = (select) => `=QUERY('${sourceSheetName}'!A:AH, "${select}", 1)`;

  // Page-wide background + grid removal for a calm canvas.
  dash.getRange("A1:H60").setBackground(DASH_COLORS.bgPage);
  dash.setHiddenGridlines(true);

  // Title + subtitle block (A1:H2 merged each).
  dash
    .getRange("A1:H1")
    .merge()
    .setValue("4626 Outreach Dashboard")
    .setFontSize(22)
    .setFontWeight("bold")
    .setFontColor(DASH_COLORS.divider)
    .setVerticalAlignment("middle");
  dash.setRowHeight(1, 44);

  dash
    .getRange("A2:H2")
    .merge()
    .setValue(
      "Live view over the Creators sheet. Numbers update automatically as you edit rows.",
    )
    .setFontSize(11)
    .setFontColor(DASH_COLORS.neutral)
    .setVerticalAlignment("middle");
  dash.setRowHeight(2, 22);

  // ── KPI CARDS row (A4:H7) ──────────────────────────────────────────────
  // Three cards: Total creators | Reachable | Reach rate. Each is a 2-row
  // 2-column merged block: label row + big-number row.
  renderKpiCard(dash, "A4:B5", "TOTAL CREATORS", {
    formula: `=COUNTA('${sourceSheetName}'!${col.name}2:${col.name})`,
    format: "#,##0",
    color: DASH_COLORS.divider,
  });
  renderKpiCard(dash, "D4:E5", "REACHABLE ON BASE APP", {
    formula: `=COUNTIF('${sourceSheetName}'!${col.reachable}2:${col.reachable}, TRUE)`,
    format: "#,##0",
    color: DASH_COLORS.success,
  });
  renderKpiCard(dash, "G4:H5", "REACH RATE", {
    formula: `=IFERROR(COUNTIF('${sourceSheetName}'!${col.reachable}2:${col.reachable}, TRUE) / COUNTA('${sourceSheetName}'!${col.name}2:${col.name}), 0)`,
    format: "0.0%",
    color: DASH_COLORS.accent,
  });

  dash.setRowHeight(4, 20);
  dash.setRowHeight(5, 48);

  // ── SEGMENTATION section (A8 down) ─────────────────────────────────────
  renderSectionDivider(dash, "A7:H7", "SEGMENTATION");
  dash.setRowHeight(7, 28);

  dash
    .getRange("A9")
    .setValue("Reachable by cohort × priority")
    .setFontWeight("bold")
    .setFontSize(12);
  dash
    .getRange("G9")
    .setValue("Winning XMTP address kind")
    .setFontWeight("bold")
    .setFontSize(12);

  dash
    .getRange("A10")
    .setFormula(
      q(
        `SELECT ${col.cohort}, COUNT(${col.name}) WHERE ${col.reachable}=TRUE GROUP BY ${col.cohort} PIVOT ${col.priority}`,
      ),
    );

  dash
    .getRange("G10")
    .setFormula(
      q(
        `SELECT ${col.xmtpKind}, COUNT(${col.name}) WHERE ${col.reachable}=TRUE GROUP BY ${col.xmtpKind} ORDER BY COUNT(${col.name}) DESC LABEL COUNT(${col.name}) 'Rows'`,
      ),
    );

  // Style the header row of each pivot table (A10:E10 and G10:H10).
  styleQueryHeader(dash, "A10:E10");
  styleQueryHeader(dash, "G10:H10");

  // ── WORKFLOW section ───────────────────────────────────────────────────
  renderSectionDivider(dash, "A18:H18", "WORKFLOW");
  dash.setRowHeight(18, 28);

  dash
    .getRange("A20")
    .setValue("Status funnel")
    .setFontWeight("bold")
    .setFontSize(12);
  dash
    .getRange("G20")
    .setValue("Install readiness (reachable only)")
    .setFontWeight("bold")
    .setFontSize(12);

  dash
    .getRange("A21")
    .setFormula(
      q(
        `SELECT ${col.status}, COUNT(${col.name}) WHERE ${col.status} IS NOT NULL GROUP BY ${col.status} ORDER BY COUNT(${col.name}) DESC LABEL COUNT(${col.name}) 'Rows'`,
      ),
    );
  dash
    .getRange("G21")
    .setFormula(
      q(
        `SELECT ${col.readiness}, COUNT(${col.name}) WHERE ${col.reachable}=TRUE GROUP BY ${col.readiness} ORDER BY COUNT(${col.name}) DESC LABEL COUNT(${col.name}) 'Rows'`,
      ),
    );

  styleQueryHeader(dash, "A21:B21");
  styleQueryHeader(dash, "G21:H21");

  // ── Charts ─────────────────────────────────────────────────────────────
  // Stacked column: cohort × priority. Anchor below the WORKFLOW tables.
  try {
    const cohortChart = dash
      .newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(dash.getRange("A10:E13"))
      .setOption("title", "Reachable creators by cohort and priority")
      .setOption("isStacked", true)
      .setOption("legend", { position: "bottom" })
      .setOption("colors", ["#d93025", "#e8710a", "#f9ab00", "#9aa0a6"])
      .setOption("height", 280)
      .setOption("width", 520)
      .setPosition(30, 1, 0, 0)
      .build();
    dash.insertChart(cohortChart);

    // Donut: winning XMTP address kind.
    const kindChart = dash
      .newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(dash.getRange("G10:H13"))
      .setOption("title", "Winning XMTP address kind")
      .setOption("pieHole", 0.55)
      .setOption("legend", { position: "right" })
      .setOption("colors", ["#1a73e8", "#188038", "#9aa0a6"])
      .setOption("height", 280)
      .setOption("width", 380)
      .setPosition(30, 6, 0, 0)
      .build();
    dash.insertChart(kindChart);
  } catch (err) {
    console.warn("Chart insertion failed (non-fatal): " + err);
  }

  // Column widths. Three equal KPI-card widths, plus space for pivots.
  dash.setColumnWidth(1, 210); // A
  dash.setColumnWidth(2, 210); // B
  dash.setColumnWidth(3, 30);  // C — gutter
  dash.setColumnWidth(4, 210); // D
  dash.setColumnWidth(5, 210); // E
  dash.setColumnWidth(6, 30);  // F — gutter
  dash.setColumnWidth(7, 210); // G
  dash.setColumnWidth(8, 210); // H
}

function renderKpiCard(sheet, a1Range, label, spec) {
  // Card is a 2-row block: label row on top, big value on bottom.
  const range = sheet.getRange(a1Range);
  const startRow = range.getRow();
  const startCol = range.getColumn();
  const numCols = range.getNumColumns();
  range.breakApart(); // safety for re-runs

  const labelRange = sheet.getRange(startRow, startCol, 1, numCols).merge();
  labelRange
    .setValue(label)
    .setFontSize(10)
    .setFontColor(DASH_COLORS.neutral)
    .setFontWeight("bold")
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle")
    .setBackground(DASH_COLORS.cardBg)
    .setBorder(true, true, false, true, false, false,
      DASH_COLORS.cardBorder, SpreadsheetApp.BorderStyle.SOLID);

  const valueRange = sheet
    .getRange(startRow + 1, startCol, 1, numCols)
    .merge();
  valueRange
    .setFormula(spec.formula)
    .setNumberFormat(spec.format)
    .setFontSize(28)
    .setFontWeight("bold")
    .setFontColor(spec.color)
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle")
    .setBackground(DASH_COLORS.cardBg)
    .setBorder(false, true, true, true, false, false,
      DASH_COLORS.cardBorder, SpreadsheetApp.BorderStyle.SOLID);
}

function renderSectionDivider(sheet, a1Range, label) {
  sheet
    .getRange(a1Range)
    .merge()
    .setValue(label)
    .setFontSize(11)
    .setFontWeight("bold")
    .setFontColor(DASH_COLORS.neutral)
    .setBackground(DASH_COLORS.sectionBg)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("left");
}

function styleQueryHeader(sheet, a1Range) {
  sheet
    .getRange(a1Range)
    .setBackground(DASH_COLORS.tableHeader)
    .setFontColor(DASH_COLORS.tableHeaderText)
    .setFontWeight("bold");
}

function colLetter(columnName, ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = headerIndexMap(sheet);
  const idx = headers.get(columnName);
  if (idx == null) throw new Error(`Column not found: ${columnName}`);
  // 0-indexed → A1 letter
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
