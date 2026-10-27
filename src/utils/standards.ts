export const NJSLS_STANDARDS: { [key: string]: string } = {
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

export function getStandardDescription(code?: string): string | null {
  if (!code) return null;
  const clean = code.trim();
  if (NJSLS_STANDARDS[clean]) return NJSLS_STANDARDS[clean];
  
  const lower = clean.toLowerCase();
  for (const [k, v] of Object.entries(NJSLS_STANDARDS)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}
