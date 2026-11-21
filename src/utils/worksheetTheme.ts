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
//   - Accelerated PODs also get a bold DASHED frame around the whole page.
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
  /** Optional bold dashed frame around the page perimeter (between fiducials). */
  pageFrame?: 'dashed';
}

export const MATH6_POD_FOLDER = 'Math 6 PODs';
export const ACCELERATED_POD_FOLDER = 'Accelerated PODs';

/** Detects which class a POD belongs to from its title / folder. */
export function detectPodClass(ws: Pick<Worksheet, 'title' | 'folder_name'>): PodClass {
  const text = `${ws.title || ''} ${ws.folder_name || ''}`;
  if (/\b(accel|accelerated|adv|advanced|honors)\b/i.test(text)) return 'accelerated';
  if (/\bmath\s*6\b/i.test(text)) return 'math6';
  return null;
}

/**
 * Infers the appropriate folder for a worksheet (separating Accelerated PODs vs Math 6 PODs)
 * when the current folder is a generic/default POD folder or unset.
 */
export function resolveWorksheetFolder(
  title: string | undefined,
  currentFolder: string | undefined,
  stylePreset?: string
): string {
  const cleanTitle = String(title || '').trim();
  const cleanFolder = String(currentFolder || '').trim();
  const isPodLike =
    stylePreset === 'pod' ||
    /\bpod\b|problem of the day/i.test(cleanTitle) ||
    cleanFolder === 'Daily Warm-Ups (POD)' ||
    cleanFolder === MATH6_POD_FOLDER ||
    cleanFolder === ACCELERATED_POD_FOLDER;

  if (isPodLike) {
    if (/\b(accel|accelerated|adv|advanced|honors)\b/i.test(cleanTitle)) {
      return ACCELERATED_POD_FOLDER;
    }
    if (/\bmath\s*6\b/i.test(cleanTitle)) {
      return MATH6_POD_FOLDER;
    }
  }

  return cleanFolder || 'General';
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
          accent: [22, 163, 74], // green-600
          tint: [240, 253, 244], // green-50
          ink: [20, 83, 45], // green-900
          headerStyle: 'solid',
          borderStyle: 'double',
          numberShape: 'circle',
          pageFrame: 'dashed',
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
