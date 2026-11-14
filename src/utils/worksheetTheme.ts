import { Worksheet } from '../types/worksheet';

// ----------------------------------------------------------------------------
// Visual identity per worksheet type (and per class for Problems of the Day).
//
// Shared by the on-screen preview (WorksheetPage) and the PDF (pdfGenerator)
// so both always match. Themes only change colors, labels and line styles —
// never the geometry of work/answer boxes, QR code, or fiducials — so OCR /
// autograder bounding boxes are unaffected.
//
// Distinctions are designed to read instantly on a black & white copy:
//   - POD cards use a SOLID filled header bar (white text); everything else tinted.
//   - Accelerated PODs use a DOUBLE card border; Math 6 PODs a single thick one.
//   - Class tag (MATH 6 / ACCELERATED) is printed in the masthead and every card.
// ----------------------------------------------------------------------------

export type RGB = [number, number, number];

export type PodClass = 'math6' | 'accelerated' | null;

export interface WorksheetTheme {
  /** Badge text next to the title (ASCII only — jsPDF helvetica can't draw emoji). */
  badgeLabel: string;
  /** Emoji prefix for the HTML badge only. */
  badgeIcon: string;
  /** Optional class tag (POD only), e.g. MATH 6 / ACCELERATED. */
  classLabel: string | null;
  /** Strong accent color (borders, number badges, solid header bars). */
  accent: RGB;
  /** Light tint (tinted header bars, badge fills). */
  tint: RGB;
  /** Dark text color for use on the tint. */
  ink: RGB;
  /**
   * solid  = accent-filled header bar, white text
   * tint   = light tinted header bar
   * hatch  = diagonal accent stripes, text on white chips
   * outline = white header with heavy dashed rule underneath
   */
  headerStyle: 'solid' | 'tint' | 'hatch' | 'outline';
  /** Card outline treatment. */
  borderStyle: 'single' | 'thick' | 'heavy' | 'double' | 'heavy-double' | 'dashed';
  /** Question number badge shape. */
  numberShape: 'square' | 'circle';
}

/** Detects which class a POD belongs to from its title / folder. */
export function detectPodClass(ws: Pick<Worksheet, 'title' | 'folder_name'>): PodClass {
  const text = `${ws.title || ''} ${ws.folder_name || ''}`;
  if (/\b(accel|accelerated|adv|advanced|honors)\b/i.test(text)) return 'accelerated';
  if (/\bmath\s*6\b/i.test(text)) return 'math6';
  return null;
}

export function getWorksheetTheme(
  ws: Pick<Worksheet, 'style_preset' | 'title' | 'folder_name'>
): WorksheetTheme {
  switch (ws.style_preset) {
    case 'pod': {
      const podClass = detectPodClass(ws);
      if (podClass === 'accelerated') {
        return {
          badgeLabel: 'PROBLEM OF THE DAY',
          badgeIcon: '★',
          classLabel: 'ACCELERATED',
          accent: [180, 83, 9], // amber-700
          tint: [255, 247, 237], // orange-50
          ink: [124, 45, 18], // orange-900
          headerStyle: 'solid',
          borderStyle: 'double',
          numberShape: 'circle',
        };
      }
      if (podClass === 'math6') {
        return {
          badgeLabel: 'PROBLEM OF THE DAY',
          badgeIcon: '★',
          classLabel: 'MATH 6',
          accent: [3, 105, 161], // sky-700
          tint: [240, 249, 255], // sky-50
          ink: [12, 74, 110], // sky-900
          headerStyle: 'solid',
          borderStyle: 'thick',
          numberShape: 'circle',
        };
      }
      return {
        badgeLabel: 'PROBLEM OF THE DAY',
        badgeIcon: '★',
        classLabel: null,
        accent: [51, 65, 85], // slate-700
        tint: [241, 245, 249],
        ink: [15, 23, 42],
        headerStyle: 'solid',
        borderStyle: 'thick',
        numberShape: 'circle',
      };
    }
    case 'classwork':
      return {
        badgeLabel: 'CLASSWORK',
        badgeIcon: '✏️',
        classLabel: null,
        accent: [4, 120, 87], // emerald-700
        tint: [236, 253, 245],
        ink: [6, 78, 59],
        headerStyle: 'tint',
        borderStyle: 'double',
        numberShape: 'square',
      };
    case 'quiz':
      return {
        badgeLabel: 'QUIZ',
        badgeIcon: '📝',
        classLabel: null,
        accent: [185, 28, 28], // red-700
        tint: [254, 242, 242],
        ink: [127, 29, 29],
        headerStyle: 'tint',
        borderStyle: 'thick',
        numberShape: 'square',
      };
    case 'exit_ticket':
      return {
        badgeLabel: 'EXIT TICKET',
        badgeIcon: '🎟️',
        classLabel: null,
        accent: [13, 148, 136], // teal-600
        tint: [240, 253, 250],
        ink: [19, 78, 74],
        headerStyle: 'tint',
        borderStyle: 'single',
        numberShape: 'square',
      };
    case 'spiral':
    case 'homework':
    default:
      return {
        badgeLabel: 'SPIRAL REVIEW',
        badgeIcon: '🔄',
        classLabel: null,
        accent: [79, 70, 229], // indigo-600
        tint: [238, 242, 255],
        ink: [49, 46, 129],
        headerStyle: 'tint',
        borderStyle: 'single',
        numberShape: 'square',
      };
  }
}

export const rgb = ([r, g, b]: RGB): string => `rgb(${r}, ${g}, ${b})`;
