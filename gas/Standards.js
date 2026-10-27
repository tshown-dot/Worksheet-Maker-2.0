/**
 * ==============================================================================
 * WORKSHEET MAKER 2.0 - STANDARDS MAP & STUDENT MONITORING ENGINE
 * ==============================================================================
 */

// Complete NJSLS / Common Core Math Standards (Grades 4-8) to Plain English Map
const STANDARDS_DICTIONARY = {
  // Grade 4
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

  // Grade 5
  "5.OA.A.1": "Evaluating Expressions (Order of Operations)",
  "5.NBT.A.1": "Place Value & Decimals",
  "5.NBT.A.3b": "Comparing Decimals",
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

  // Grade 6
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

  // Grade 7
  "7.RP.A.1": "Unit Rates with Fractions",
  "7.RP.A.2": "Proportional Relationships",
  "7.RP.A.3": "Multi-Step Ratio & Percent Problems",
  "7.NS.A.1": "Adding & Subtracting Rational Numbers",
  "7.NS.A.1c": "Subtracting Rational Numbers",
  "7.NS.A.1d": "Rational Number Operations",
  "7.NS.A.2": "Multiplying & Dividing Rational Numbers",
  "7.NS.A.3": "Four Operations with Rational Numbers",
  "7.EE.A.1": "Linear Expressions with Rational Coefficients",
  "7.EE.A.2": "Rewriting Expressions in Different Forms",
  "7.EE.B.3": "Multi-Step Real-Life Problems with Rational Numbers",
  "7.EE.B.4": "Solving Two-Step Equations & Inequalities",
  "7.G.A.1": "Scale Drawings of Geometric Figures",
  "7.G.B.4": "Area & Circumference of a Circle",
  "7.G.B.5": "Supplementary, Complementary, & Vertical Angles",
  "7.G.B.6": "Area, Volume & Surface Area of 2D/3D Objects",
  "7.SP.A.1": "Representative Samples & Populations",
  "7.SP.B.4": "Measures of Center & Variability",
  "7.SP.C.5": "Understanding Probability of Chance Events",
  "7.SP.C.8": "Probability of Compound Events",

  // Grade 8
  "8.NS.A.1": "Rational & Irrational Numbers",
  "8.NS.A.2": "Rational Approximations of Irrational Numbers",
  "8.EE.A.1": "Properties of Integer Exponents",
  "8.EE.A.2": "Square Roots & Cube Roots",
  "8.EE.A.3": "Scientific Notation",
  "8.EE.A.4": "Operations with Scientific Notation",
  "8.EE.B.5": "Graphing Proportional Relationships & Slope",
  "8.EE.B.6": "Deriving y = mx and y = mx + b",
  "8.EE.C.7": "Solving Linear Equations in One Variable",
  "8.EE.C.8": "Systems of Linear Equations",
  "8.F.A.1": "Understanding Functions",
  "8.F.A.2": "Comparing Functions",
  "8.F.A.3": "Linear vs. Nonlinear Functions",
  "8.F.B.4": "Modeling with Linear Functions",
  "8.G.A.1": "Rigid Transformations (Translations, Rotations, Reflections)",
  "8.G.A.3": "Transformations & Dilations on Coordinate Plane",
  "8.G.A.5": "Angle Sum & Exterior Angles of Triangles",
  "8.G.B.7": "Applying the Pythagorean Theorem",
  "8.G.B.8": "Pythagorean Theorem Distance on Coordinate Plane",
  "8.G.C.9": "Volume of Cylinders, Cones, & Spheres",
  "8.SP.A.1": "Scatter Plots & Bivariate Data",
  "8.SP.A.2": "Line of Best Fit"
};

/**
 * Translates a standard code into Plain English
 * @param {string} code - e.g. "6.NS.C.7a" or "7.EE.B.4"
 * @returns {string} Plain English title
 */
function translateStandard(code) {
  if (!code) return "General Math";
  const clean = String(code).trim();
  if (STANDARDS_DICTIONARY[clean]) return STANDARDS_DICTIONARY[clean];

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
  sheet.setColumnWidth(2, 380);
  sheet.setFrozenRows(1);
}

/**
 * Sets up and updates the "Student Monitoring" tab:
 * Ties every Student ID to the "Student Roster" tab (Student Name & Class/Period)
 * and analyzes all graded submissions to compute:
 * - Graded Work Count
 * - Overall Average %
 * - Active Unit Need (lowest current concept)
 * - Actionable Gap (20% - 69% mastery)
 * - Structural Blocker (< 20% mastery on prerequisite standards)
 */
function updateStudentMonitoringSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let monitorSheet = ss.getSheetByName('Student Monitoring');
  if (!monitorSheet) {
    monitorSheet = ss.insertSheet('Student Monitoring');
  }

  const rosterInfo = typeof getRosterData === 'function' ? getRosterData() : { byId: {}, list: [] };
  const gradebook = ss.getSheetByName('Gradebook');

  // Map: studentId -> { studentId, studentName, classPeriod, submissions, totalEarned, totalPossible, standards: { stdCode: { attempts, correct } } }
  const studentMap = {};

  // Seed with all students from Student Roster first so missing students are also visible
  for (const rStudent of rosterInfo.list) {
    studentMap[rStudent.studentId] = {
      studentId: rStudent.studentId,
      studentName: rStudent.studentName,
      classPeriod: rStudent.classPeriod || '',
      submissions: 0,
      totalEarned: 0,
      totalPossible: 0,
      standards: {}
    };
  }

  if (gradebook && gradebook.getLastRow() > 1) {
    const gbData = gradebook.getDataRange().getValues();
    const headers = gbData[0].map(h => String(h || '').trim().toLowerCase());
    const rows = gbData.slice(1);

    const idCol = headers.indexOf('student id') !== -1 ? headers.indexOf('student id') : 1;
    const nameCol = headers.indexOf('student name');
    const periodCol = headers.indexOf('class / period');
    const ptsCol = headers.indexOf('points') !== -1 ? headers.indexOf('points') : 5;
    const totalPtsCol = headers.indexOf('total pts') !== -1 ? headers.indexOf('total pts') : 6;
    const q1ScoreCol = headers.indexOf('q1 score') !== -1 ? headers.indexOf('q1 score') : 8;

    for (const r of rows) {
      const rawId = String(r[idCol] || '').trim();
      const rawName = nameCol !== -1 ? String(r[nameCol] || '').trim() : '';
      const rawPeriod = periodCol !== -1 ? String(r[periodCol] || '').trim() : '';

      const resolved = typeof resolveStudentFromRoster === 'function'
        ? resolveStudentFromRoster(rawId, rawName, rosterInfo)
        : { studentId: rawId || '???', studentName: rawName || 'Unmatched Student', classPeriod: rawPeriod };

      const key = resolved.studentId !== '???' ? resolved.studentId : (resolved.studentName || '???');
      if (key === '???' && !rawName) continue;

      if (!studentMap[key]) {
        studentMap[key] = {
          studentId: resolved.studentId,
          studentName: resolved.studentName || 'Unlisted in Roster',
          classPeriod: resolved.classPeriod || rawPeriod || '',
          submissions: 0,
          totalEarned: 0,
          totalPossible: 0,
          standards: {}
        };
      } else {
        if (!studentMap[key].studentName && resolved.studentName) {
          studentMap[key].studentName = resolved.studentName;
        }
        if (!studentMap[key].classPeriod && (resolved.classPeriod || rawPeriod)) {
          studentMap[key].classPeriod = resolved.classPeriod || rawPeriod;
        }
      }

      const sData = studentMap[key];
      sData.submissions++;
      const earned = parseFloat(r[ptsCol]) || 0;
      const possible = parseFloat(r[totalPtsCol]) || 0;
      sData.totalEarned += earned;
      sData.totalPossible += possible;

      // Inspect Q1..Q10 columns for standard tags
      for (let q = 0; q < 10; q++) {
        const baseCol = q1ScoreCol + (q * 3);
        if (baseCol + 2 >= r.length) break;
        const cellVal = r[baseCol];
        if (cellVal === '' || cellVal === null || cellVal === undefined) continue;

        const qScore = parseFloat(cellVal) || 0;
        const qFeedback = String(r[baseCol + 2] || '');

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
  }

  const outHeaders = [
    'Student ID',
    'Student Name',
    'Class / Period',
    'Submissions',
    'Overall Avg',
    'Active Unit Need',
    'Need (%)',
    'Actionable Gap (20-69%)',
    'Gap (%)',
    'Structural Blocker (<20%)',
    'Blocker (%)',
    'Intervention Recommendations'
  ];

  const outRows = [outHeaders];

  const sortedStudents = Object.values(studentMap).sort((a, b) =>
    String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true })
  );

  for (const sData of sortedStudents) {
    if (sData.submissions === 0) {
      outRows.push([
        sData.studentId,
        sData.studentName || '—',
        sData.classPeriod || '—',
        0,
        '—',
        '—',
        '',
        '—',
        '',
        '—',
        '',
        'Missing / No Scans Yet'
      ]);
      continue;
    }

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

      if (rate < 20 && blocker === 'None') {
        blocker = `${plainName} (${code})`;
        blockerPct = `${rate}%`;
      }

      if (rate >= 20 && rate < 70 && rate < gapRate) {
        gap = `${plainName} (${code})`;
        gapPct = `${rate}%`;
        gapRate = rate;
      }

      if (rate < lowestRate) {
        lowestRate = rate;
        activeNeed = `${plainName} (${code})`;
        needPct = `${rate}%`;
      }
    }

    const recommendation = blocker !== 'None'
      ? 'Immediate Prerequisite Intervention'
      : (gap !== 'None' ? 'Target for Warm-Up Review' : (overallAvg < 70 ? 'Review Computation Accuracy' : 'On Track'));

    outRows.push([
      sData.studentId,
      sData.studentName || 'Unlisted in Roster',
      sData.classPeriod || '—',
      sData.submissions,
      `${overallAvg}%`,
      activeNeed,
      needPct,
      gap,
      gapPct,
      blocker,
      blockerPct,
      recommendation
    ]);
  }

  monitorSheet.clear();
  monitorSheet.getRange(1, 1, outRows.length, outHeaders.length).setValues(outRows);

  const header = monitorSheet.getRange(1, 1, 1, outHeaders.length);
  header.setBackground('#1e293b');
  header.setFontColor('#ffffff');
  header.setFontWeight('bold');
  header.setHorizontalAlignment('center');
  monitorSheet.setRowHeight(1, 35);
  monitorSheet.setFrozenRows(1);
  monitorSheet.setFrozenColumns(2);

  // Format Status & Overall Avg colors
  for (let rIdx = 2; rIdx <= outRows.length; rIdx++) {
    const avgVal = String(outRows[rIdx - 1][4] || '');
    const statusVal = String(outRows[rIdx - 1][11] || '');
    const avgCell = monitorSheet.getRange(rIdx, 5);
    const statusCell = monitorSheet.getRange(rIdx, 12);

    if (avgVal.endsWith('%')) {
      const pct = parseFloat(avgVal);
      if (pct >= 80) {
        avgCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
      } else if (pct >= 60) {
        avgCell.setBackground('#fef9c3').setFontColor('#854d0e').setFontWeight('bold');
      } else {
        avgCell.setBackground('#fee2e2').setFontColor('#991b1b').setFontWeight('bold');
      }
    }

    if (statusVal.includes('Immediate')) {
      statusCell.setBackground('#fee2e2').setFontColor('#991b1b').setFontWeight('bold');
    } else if (statusVal.includes('Warm-Up') || statusVal.includes('Review')) {
      statusCell.setBackground('#fef9c3').setFontColor('#854d0e').setFontWeight('bold');
    } else if (statusVal === 'On Track') {
      statusCell.setBackground('#dcfce7').setFontColor('#166534').setFontWeight('bold');
    } else if (statusVal.includes('Missing')) {
      statusCell.setBackground('#f1f5f9').setFontColor('#64748b').setFontStyle('italic');
    }
  }
}
