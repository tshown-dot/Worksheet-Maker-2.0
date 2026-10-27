/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - STANDARDS MAP & STUDENT MONITORING ENGINE
 * ==============================================================================
 */

// Complete Common Core Math Standards to Plain English Map
const STANDARDS_DICTIONARY = {
  "4.OA.A.1": "Multiplicative Comparisons",
  "4.OA.A.3": "Multi-Step Word Problems",
  "4.NBT.A.1": "Place Value Concepts",
  "4.NBT.B.4": "Adding & Subtracting Multi-Digit Numbers",
  "4.NBT.B.5": "Multiplying Multi-Digit Numbers",
  "4.NBT.B.6": "Dividing Multi-Digit Numbers",
  "4.NF.A.1": "Equivalent Fractions",
  "4.NF.B.3": "Adding & Subtracting Fractions",
  "4.NF.B.4": "Multiplying Fractions by Whole Numbers",
  "4.NF.C.6": "Decimal Notation for Fractions",
  "4.MD.A.1": "Measurement Conversions",
  "4.MD.A.3": "Area & Perimeter",
  "4.G.A.1": "Points, Lines, & Angles",
  "5.OA.A.1": "Evaluating Expressions (Order of Operations)",
  "5.NBT.A.1": "Place Value & Decimals",
  "5.NBT.A.4": "Rounding Decimals",
  "5.NBT.B.5": "Multiplying Multi-Digit Whole Numbers",
  "5.NBT.B.6": "Dividing Multi-Digit Whole Numbers",
  "5.NBT.B.7": "Decimal Operations (Add/Sub/Mult/Div)",
  "5.NF.A.1": "Adding & Subtracting Fractions (Unlike Denominators)",
  "5.NF.B.4": "Multiplying Fractions",
  "5.NF.B.6": "Solving Real-World Fraction Problems",
  "5.NF.B.7": "Dividing Fractions",
  "5.MD.C.5": "Volume of Rectangular Prisms",
  "5.G.A.1": "Graphing on the Coordinate Plane",
  "6.RP.A.1": "Understanding Ratios",
  "6.RP.A.2": "Unit Rates",
  "6.RP.A.3": "Solving Ratio & Percent Problems",
  "6.NS.A.1": "Dividing Fractions by Fractions",
  "6.NS.B.2": "Long Division",
  "6.NS.B.3": "Decimal Operations (Add/Sub/Mult/Div)",
  "6.NS.B.4": "Greatest Common Factor & Least Common Multiple",
  "6.NS.C.5": "Understanding Positive & Negative Numbers",
  "6.NS.C.6a": "Opposites on Number Lines",
  "6.NS.C.6b": "Signs of Numbers in Quadrants",
  "6.NS.C.6c": "Plotting Rational Numbers & Coordinates",
  "6.NS.C.7a": "Comparing & Ordering Rational Numbers",
  "6.NS.C.7b": "Writing & Interpreting Inequalities",
  "6.NS.C.7c": "Understanding Absolute Value & Magnitude",
  "6.NS.C.8": "Distance on the Coordinate Plane",
  "6.EE.A.1": "Whole-Number Exponents",
  "6.EE.A.2": "Writing & Evaluating Algebraic Expressions",
  "6.EE.A.3": "Applying Properties of Operations",
  "6.EE.A.4": "Identifying Equivalent Expressions",
  "6.EE.B.5": "Understanding Solving Equations",
  "6.EE.B.6": "Using Variables in Real-World Problems",
  "6.EE.B.7": "Solving One-Step Equations",
  "6.EE.B.8": "Inequalities on Number Lines",
  "6.EE.C.9": "Dependent & Independent Variables",
  "6.G.A.1": "Area of Polygons",
  "6.G.A.2": "Volume with Fractional Edge Lengths",
  "6.G.A.3": "Polygons on the Coordinate Plane",
  "6.G.A.4": "Surface Area Using Nets",
  "6.SP.A.1": "Recognizing Statistical Questions",
  "6.SP.B.4": "Displaying Numerical Data",
  "6.SP.B.5": "Summarizing Data (Mean, Median, Mode)",
  "7.RP.A.1": "Unit Rates with Fractions",
  "7.RP.A.2": "Proportional Relationships",
  "7.RP.A.3": "Multi-Step Percent Problems",
  "7.NS.A.1": "Adding & Subtracting Rational Numbers",
  "7.NS.A.2": "Multiplying & Dividing Rational Numbers",
  "7.EE.A.1": "Linear Expressions with Rational Coefficients",
  "7.EE.B.4": "Solving Multi-Step Real-Life Equations"
};

/**
 * Translates a standard code into Plain English
 * @param {string} code - e.g. "6.NS.C.7a" or "5.G.A.1"
 * @returns {string} Plain English title
 */
function translateStandard(code) {
  if (!code) return "General Math";
  const clean = code.trim();
  // Direct match
  if (STANDARDS_DICTIONARY[clean]) return STANDARDS_DICTIONARY[clean];

  // Case-insensitive match
  const lower = clean.toLowerCase();
  for (const [k, v] of Object.entries(STANDARDS_DICTIONARY)) {
    if (k.toLowerCase() === lower) return v;
  }

  return clean;
}

/**
 * Sets up the "Standards Map" tab in the Google Sheet
 */
function setupStandardsMapSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Standards Map');

  if (!sheet) {
    sheet = ss.insertSheet('Standards Map');
  }

  const rows = [['Standard Code', 'Plain English Translation']];
  for (const [code, desc] of Object.entries(STANDARDS_DICTIONARY)) {
    rows.push([code, desc]);
  }

  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  const header = sheet.getRange(1, 1, 1, 2);
  header.setBackground('#1e293b');
  header.setFontColor('#ffffff');
  header.setFontWeight('bold');
  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 360);
  sheet.setFrozenRows(1);
}

/**
 * Sets up and updates the "Student Monitoring" tab:
 * Analyzes all graded submissions and computes:
 * - Overall Average %
 * - Active Unit Need (lowest current concept)
 * - Actionable Gap (20% - 69% mastery)
 * - Structural Blocker (< 20% mastery on prerequisite standards)
 */
function updateStudentMonitoringSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gradebook = ss.getSheetByName('Gradebook');
  if (!gradebook || gradebook.getLastRow() <= 1) return;

  let monitorSheet = ss.getSheetByName('Student Monitoring');
  if (!monitorSheet) {
    monitorSheet = ss.insertSheet('Student Monitoring');
  }

  const gbData = gradebook.getDataRange().getValues();
  const rows = gbData.slice(1);

  // Map: studentId -> { totalPts, earnedPts, standards: { stdCode: { attempts, correct } } }
  const studentMap = {};

  for (const r of rows) {
    const studentId = String(r[1] || '').trim();
    if (!studentId || studentId === '???') continue;

    if (!studentMap[studentId]) {
      studentMap[studentId] = {
        totalEarned: 0,
        totalPossible: 0,
        standards: {}
      };
    }

    const sData = studentMap[studentId];
    const earned = parseFloat(r[5]) || 0;
    const possible = parseFloat(r[6]) || 0;
    sData.totalEarned += earned;
    sData.totalPossible += possible;

    // Check Q1 to Q6 feedback/rubric for standard tags
    for (let q = 0; q < 6; q++) {
      const baseCol = 8 + (q * 3);
      const qScore = parseFloat(r[baseCol]) || 0;
      const qFeedback = String(r[baseCol + 2] || '');

      // Extract standard code if present e.g. "(6.NS.C.7A)" or "5.G.A.1"
      const stdMatch = qFeedback.match(/([4-8]\.[A-Z]+\.[A-Z0-9\.]+)/i);
      const stdCode = stdMatch ? stdMatch[1].toUpperCase() : null;

      if (stdCode) {
        if (!sData.standards[stdCode]) {
          sData.standards[stdCode] = { attempts: 0, correct: 0 };
        }
        sData.standards[stdCode].attempts++;
        if (qScore > 0) sData.standards[stdCode].correct++;
      }
    }
  }

  const outRows = [
    [
      'Student ID',
      'Overall Avg',
      'Active Unit Need',
      'Need (%)',
      'Actionable Gap',
      'Gap (%)',
      'Structural Blocker (<20%)',
      'Blocker (%)',
      'Intervention Recommendations'
    ]
  ];

  for (const [studentId, sData] of Object.entries(studentMap)) {
    const overallAvg = sData.totalPossible > 0 
      ? Math.round((sData.totalEarned / sData.totalPossible) * 100) 
      : 0;

    let blocker = 'None';
    let blockerPct = '';
    let gap = 'None';
    let gapPct = '';
    let activeNeed = 'None';
    let needPct = '';

    let lowestRate = 101;
    let gapRate = 101;

    for (const [code, stat] of Object.entries(sData.standards)) {
      if (stat.attempts === 0) continue;
      const rate = Math.round((stat.correct / stat.attempts) * 100);
      const plainName = translateStandard(code);

      // Structural Blocker: < 20%
      if (rate < 20 && blocker === 'None') {
        blocker = `${plainName} (${code})`;
        blockerPct = `${rate}%`;
      }

      // Actionable Gap: 20% - 69%
      if (rate >= 20 && rate < 70 && rate < gapRate) {
        gap = `${plainName} (${code})`;
        gapPct = `${rate}%`;
        gapRate = rate;
      }

      // Lowest overall standard
      if (rate < lowestRate) {
        lowestRate = rate;
        activeNeed = `${plainName} (${code})`;
        needPct = `${rate}%`;
      }
    }

    outRows.push([
      studentId,
      `${overallAvg}%`,
      activeNeed,
      needPct,
      gap,
      gapPct,
      blocker,
      blockerPct,
      blocker !== 'None' ? 'Immediate Prerequisite Intervention' : (gap !== 'None' ? 'Target for Warm-Up Review' : 'On Track')
    ]);
  }

  monitorSheet.clear();
  monitorSheet.getRange(1, 1, outRows.length, outRows[0].length).setValues(outRows);

  const header = monitorSheet.getRange(1, 1, 1, outRows[0].length);
  header.setBackground('#1e293b');
  header.setFontColor('#ffffff');
  header.setFontWeight('bold');
  header.setHorizontalAlignment('center');
  monitorSheet.setRowHeight(1, 35);
  monitorSheet.setFrozenRows(1);
  monitorSheet.setFrozenColumns(1);
}
