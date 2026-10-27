# Worksheet Maker 2.0 (OCR-Ready)

A modern, professional math worksheet generator designed for middle school math teachers. Built with **React**, **Vite**, **Tailwind CSS**, and **Supabase**, engineered specifically for high-accuracy optical character recognition (OCR) and automated grading via school copier document feeders (ADF).

---

## 🎯 Key Features for Teachers

* **Live Math Formatting:** Real-time LaTeX math formula rendering powered by KaTeX (fractions, exponents, radicals, linear equations).
* **Style Theme Presets:**
  * **Homework Practice:** Crisp solid borders, space-efficient, clean academic feel.
  * **Problem of the Day / Warm-Up:** Distinct dashed container borders, soft gray pill badges, dotted scratchwork grid.
  * **Quiz / Assessment:** Formal header with point badges and score tally zones.
  * **Exit Ticket:** Quick 1–2 problem format for targeted formative checks.
* **Copier OCR Alignment:**
  * **4-Corner Fiducial Markers:** Solid $6\text{ mm} \times 6\text{ mm}$ corner squares for automated affine deskewing in OpenCV/Apps Script.
  * **Header Assignment QR Code:** Encodes Assignment ID & Page Number so batches of 100+ scans self-identify.
  * **3-Digit Student ID Grid:** Standardized $12\text{ mm} \times 14\text{ mm}$ single-digit entry boxes on Page 1 and Page 2.
  * **Isolated Work vs. Answer Zones:** Separates student scratchwork from high-contrast bordered "Final Answer" boxes.
* **1-Click Dual PDF Generation:**
  * **Student Test PDF:** Blank work zones and answer fields ready to print.
  * **Teacher Master / Answer Key PDF:** Blue bold pre-filled solutions with AI grading rubric guidance.
* **AI & Document Ingestion:**
  * Paste ChatGPT/Claude/Gemini JSON or standard text lists from Google Docs.

---

## 🔗 Supabase Autograder API

The Google Apps Script autograder fetches the complete answer key and millimeter bounding boxes with a single HTTP call:

```http
GET https://dgmkobsqhlfokquolkqf.supabase.co/rest/v1/rpc/get_worksheet_manifest?lookup_code=ALG-701
apikey: sb_publishable_...
```

### Response Payload:
```json
{
  "worksheet": {
    "short_code": "ALG-701",
    "title": "Unit 3: Two-Step Equations",
    "style_preset": "homework",
    "student_id_digits": 3,
    "total_pages": 1
  },
  "questions": [
    {
      "order_index": 1,
      "prompt": "Solve for x: 3x + 7 = 22",
      "correct_answer": "5",
      "acceptable_alternatives": ["x = 5", "5"],
      "points": 2,
      "rubric_notes": "1 point for subtracting 7 correctly (3x = 15). 1 point for dividing by 3.",
      "bounding_box": {
        "work_box": { "x_mm": 17, "y_mm": 68, "w_mm": 128, "h_mm": 20 },
        "answer_box": { "x_mm": 150, "y_mm": 68, "w_mm": 52, "h_mm": 20 }
      }
    }
  ]
}
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build
```
