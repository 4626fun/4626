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

  dash
    .getRange("A1")
    .setValue("4626 Outreach Dashboard")
    .setFontSize(18)
    .setFontWeight("bold");
  dash
    .getRange("A2")
    .setValue(
      "Live view over the Creators sheet. Numbers update automatically as you edit rows.",
    )
    .setFontColor("#5f6368");

  // Totals block
  dash.getRange("A4").setValue("XMTP reachability").setFontWeight("bold");
  dash.getRange("A5").setValue("Total creators");
  dash
    .getRange("B5")
    .setFormula(`=COUNTA('${sourceSheetName}'!${col.name}2:${col.name})`);
  dash.getRange("A6").setValue("Reachable on Base App / XMTP");
  dash
    .getRange("B6")
    .setFormula(
      `=COUNTIF('${sourceSheetName}'!${col.reachable}2:${col.reachable}, TRUE)`,
    );
  dash.getRange("A7").setValue("Reach rate");
  dash.getRange("B7").setFormula("=B6/B5").setNumberFormat("0.0%");

  // Cohort × priority heatmap (pivoted)
  dash
    .getRange("A9")
    .setValue("Reachable by cohort × priority")
    .setFontWeight("bold");
  dash
    .getRange("A10")
    .setFormula(
      q(
        `SELECT ${col.cohort}, COUNT(${col.name}) WHERE ${col.reachable}=TRUE GROUP BY ${col.cohort} PIVOT ${col.priority}`,
      ),
    );

  // Status funnel
  dash.getRange("A16").setValue("Status funnel").setFontWeight("bold");
  dash
    .getRange("A17")
    .setFormula(
      q(
        `SELECT ${col.status}, COUNT(${col.name}) GROUP BY ${col.status} ORDER BY COUNT(${col.name}) DESC LABEL COUNT(${col.name}) 'Rows'`,
      ),
    );

  // Winning XMTP address-kind split. Placed at column G to leave space for
  // the cohort × priority pivot at A10, which expands up to column E.
  dash
    .getRange("G9")
    .setValue("Winning XMTP address kind")
    .setFontWeight("bold");
  dash
    .getRange("G10")
    .setFormula(
      q(
        `SELECT ${col.xmtpKind}, COUNT(${col.name}) WHERE ${col.reachable}=TRUE GROUP BY ${col.xmtpKind} ORDER BY COUNT(${col.name}) DESC LABEL COUNT(${col.name}) 'Rows'`,
      ),
    );

  // Install readiness split (reachable only)
  dash
    .getRange("G16")
    .setValue("Install readiness (reachable only)")
    .setFontWeight("bold");
  dash
    .getRange("G17")
    .setFormula(
      q(
        `SELECT ${col.readiness}, COUNT(${col.name}) WHERE ${col.reachable}=TRUE GROUP BY ${col.readiness} ORDER BY COUNT(${col.name}) DESC LABEL COUNT(${col.name}) 'Rows'`,
      ),
    );

  // Column widths. A-B hold the headline KPI block, C-F carry the pivot
  // expansion room, G-H hold the right-side summary tables.
  dash.setColumnWidth(1, 260); // A — labels
  dash.setColumnWidth(2, 120); // B — values
  dash.setColumnWidth(3, 120); // C — pivot P0
  dash.setColumnWidth(4, 120); // D — pivot P1
  dash.setColumnWidth(5, 120); // E — pivot P2
  dash.setColumnWidth(6, 120); // F — pivot P3 (if present)
  dash.setColumnWidth(7, 260); // G — right block labels
  dash.setColumnWidth(8, 120); // H — right block values
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
