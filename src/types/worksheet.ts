export type QuestionType = 'numeric' | 'fraction' | 'expression' | 'multiple_choice' | 'multi_step';

export type StylePreset = 'homework' | 'pod' | 'quiz' | 'exit_ticket';

export interface BoundingBox {
  work_box: {
    x_mm: number;
    y_mm: number;
    w_mm: number;
    h_mm: number;
  };
  answer_box: {
    x_mm: number;
    y_mm: number;
    w_mm: number;
    h_mm: number;
  };
}

export interface QuestionOption {
  label: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface Question {
  id: string;
  order_index: number;
  page_number: number;
  prompt: string;
  diagram_url?: string | null;
  question_type: QuestionType;
  options: QuestionOption[];
  correct_answer: string;
  acceptable_alternatives: string[];
  points: number;
  rubric_notes: string;
  bounding_box?: BoundingBox;
}

export interface LayoutConfig {
  border_style: 'solid' | 'dashed' | 'double' | 'minimal';
  header_style: 'clean' | 'grey_pill' | 'dark_badge';
  show_dot_grid: boolean;
  columns: 1 | 2;
  show_honor_pledge: boolean;
}

export interface Worksheet {
  id: string;
  short_code: string;
  teacher_id?: string | null;
  title: string;
  subject: string;
  grade_level: string;
  style_preset: StylePreset;
  total_pages: 1 | 2;
  student_id_digits: number;
  layout_config: LayoutConfig;
  questions: Question[];
  created_at?: string;
  updated_at?: string;
}
