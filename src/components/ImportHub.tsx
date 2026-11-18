import React, { useState, useEffect } from 'react';
import { Question, StylePreset, Worksheet } from '../types/worksheet';
import { supabase } from '../lib/supabase';
import { generateWorksheetPDF } from '../utils/pdfGenerator';
import { saveWorksheetToDrive } from '../utils/googleDrive';
import {
  MATH6_POD_FOLDER,
  ACCELERATED_POD_FOLDER,
  resolveWorksheetFolder,
} from '../utils/worksheetTheme';
import { 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  ArrowRight, 
  FolderOpen, 
  PlusCircle, 
  AlertCircle,
  Calendar,
  Layers,
  Folder,
  Plus,
  Printer,
  Key,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';

interface AssignmentGroup {
  name: string;
  items: any[];
}

interface ImportHubProps {
  onImportQuestions: (
    questions: Question[],
    metadata?: { title?: string; stylePreset?: StylePreset; totalPages?: 1 | 2; folderName?: string }
  ) => void;
  onSelectSavedWorksheet?: (ws: Worksheet) => void;
  onBatchPrint?: (worksheets: Worksheet[], mode: 'student' | 'key' | 'both') => void;
  onOpenBlank: () => void;
  onOpenSavedList: () => void;
  teacherId?: string | null;
  providerToken?: string | null;
  onReconnectDrive?: () => void;
  onDriveFolderSaved?: (url: string) => void;
  onDriveTokenExpired?: () => void;
}

export const ImportHub: React.FC<ImportHubProps> = ({
  onImportQuestions,
  onSelectSavedWorksheet,
  onBatchPrint,
  onOpenBlank,
  onOpenSavedList,
  teacherId,
  providerToken,
  onDriveFolderSaved,
  onDriveTokenExpired,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedType, setCopiedType] = useState<'convert' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedGroups, setDetectedGroups] = useState<AssignmentGroup[] | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveAllMessage, setSaveAllMessage] = useState('');

  // Folder selection state
  const [folders, setFolders] = useState<string[]>([
    MATH6_POD_FOLDER,
    ACCELERATED_POD_FOLDER,
    'Spirals',
    'Unit 1: Number Systems',
    'Unit 2: Expressions & Equations',
    'General',
  ]);
  const [selectedFolder, setSelectedFolder] = useState<string>(MATH6_POD_FOLDER);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Quick-access Saved Worksheets & Batch Print Shelf
  const [savedWorksheets, setSavedWorksheets] = useState<any[]>([]);
  const [shelfFolder, setShelfFolder] = useState<string>('ALL');
  const [selectedShelfIds, setSelectedShelfIds] = useState<string[]>([]);
  const [loadingShelf, setLoadingShelf] = useState(false);
  const [autoSyncMessage, setAutoSyncMessage] = useState<string>('');
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);

  useEffect(() => {
    fetchFolders();
    fetchSavedWorksheets();

    const params = new URLSearchParams(window.location.search);
    const rawIds = params.get('autoSyncIds');
    const folderParam = params.get('folder');
    if (rawIds) {
      const ids = rawIds.split(',').map((s) => s.trim()).filter(Boolean);
      window.history.replaceState({}, '', window.location.pathname);
      if (ids.length > 0) {
        setSelectedShelfIds(ids);
        if (folderParam) {
          setShelfFolder(folderParam);
        }
        runAutoSyncForIds(ids, folderParam || undefined);
      }
    }
  }, []);

  const runAutoSyncForIds = async (ids: string[], folderOverride?: string) => {
    setIsAutoSyncing(true);
    setAutoSyncMessage(`⚡ Generating & syncing Student + Answer Key PDFs for ${ids.length} PODs to Google Drive...`);
    try {
      const fullWorksheets = await fetchFullShelfWorksheets(ids);
      await fetchSavedWorksheets();
      let syncedCount = 0;

      for (const fullWs of fullWorksheets) {
        try {
          const sDoc = await generateWorksheetPDF(fullWs, { isAnswerKey: false });
          const kDoc = await generateWorksheetPDF(fullWs, { isAnswerKey: true });
          const safeTitle = (fullWs.title || 'Worksheet').replace(/[^a-zA-Z0-9]/g, '_');
          const baseName = `${fullWs.short_code}_${safeTitle}`;
          const targetFolder = fullWs.folder_name || folderOverride || 'Daily Warm-Ups (POD)';

          const driveRes = await saveWorksheetToDrive(
            providerToken || null,
            targetFolder,
            sDoc.output('blob'),
            kDoc.output('blob'),
            baseName
          );

          if (fullWs.id && (driveRes.studentFileId || driveRes.keyFileId)) {
            await supabase
              .from('worksheets')
              .update({
                layout_config: {
                  ...(fullWs.layout_config || { columns: 2, spacing: 'balanced', track_standards: true }),
                  drive_student_file_id: driveRes.studentFileId,
                  drive_key_file_id: driveRes.keyFileId,
                },
              })
              .eq('id', fullWs.id);
          }
          if (driveRes.folderUrl && onDriveFolderSaved) {
            onDriveFolderSaved(driveRes.folderUrl);
          }
          syncedCount++;
          setAutoSyncMessage(
            `⚡ Synced ${syncedCount}/${fullWorksheets.length} POD PDFs to Google Drive ("${targetFolder}")...`
          );
        } catch (dErr: any) {
          console.warn('Auto-sync Drive upload warning:', dErr);
          if (dErr?.message === 'DRIVE_AUTH_EXPIRED' && onDriveTokenExpired) {
            onDriveTokenExpired();
          }
        }
      }

      await fetchSavedWorksheets();
      setIsAutoSyncing(false);
      setAutoSyncMessage(
        `✅ All ${fullWorksheets.length} Daily PODs generated, saved, and synced to Google Drive! They are pre-selected below for 1-click printing.`
      );
    } catch (err: any) {
      setIsAutoSyncing(false);
      setAutoSyncMessage(`⚠️ Auto-sync warning: ${err.message}`);
    }
  };

  const fetchSavedWorksheets = async () => {
    try {
      const { data } = await supabase
        .from('worksheets')
        .select('id, short_code, title, subject, grade_level, folder_name, style_preset, total_pages, columns, spacing, track_standards, student_id_digits, layout_config, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) {
        setSavedWorksheets(data);
      }
    } catch {}
  };

  const fetchFullShelfWorksheets = async (wsIds: string[]): Promise<Worksheet[]> => {
    const { data: wsRows, error: wsError } = await supabase
      .from('worksheets')
      .select('*')
      .in('id', wsIds);
    if (wsError) throw wsError;

    const { data: qRows, error: qError } = await supabase
      .from('questions')
      .select('*')
      .in('worksheet_id', wsIds)
      .order('page_number', { ascending: true })
      .order('order_index', { ascending: true });
    if (qError) throw qError;

    const qByWs = new Map<string, any[]>();
    for (const q of qRows || []) {
      const list = qByWs.get(q.worksheet_id) || [];
      list.push(q);
      qByWs.set(q.worksheet_id, list);
    }

    const rowMap = new Map<string, any>((wsRows || []).map((r: any) => [r.id, r]));

    return wsIds
      .map((id) => rowMap.get(id))
      .filter(Boolean)
      .map((wsData: any) => ({
        id: wsData.id,
        short_code: wsData.short_code,
        title: wsData.title,
        subject: wsData.subject,
        grade_level: wsData.grade_level,
        folder_name: wsData.folder_name || 'General',
        style_preset: wsData.style_preset,
        total_pages: wsData.total_pages || 1,
        columns: wsData.columns || wsData.layout_config?.columns || 2,
        spacing: wsData.spacing || wsData.layout_config?.spacing || 'balanced',
        track_standards: wsData.track_standards !== false,
        student_id_digits: wsData.student_id_digits || 3,
        layout_config: wsData.layout_config || {
          border_style: 'solid',
          header_style: 'clean',
          show_dot_grid: false,
          columns: 2,
          show_honor_pledge: false,
        },
        questions: (qByWs.get(wsData.id) || []).map((q: any) => ({
          id: q.id,
          order_index: q.order_index,
          page_number: q.page_number,
          prompt: q.prompt,
          diagram_url: q.diagram_url,
          question_type: q.question_type,
          options: q.options || [],
          correct_answer: q.correct_answer,
          acceptable_alternatives: q.acceptable_alternatives || [],
          points: q.points || 1,
          rubric_notes: q.rubric_notes || '',
          standard: q.standard || undefined,
          bounding_box: q.bounding_box,
        })),
      }));
  };

  const handleOpenSavedFromShelf = async (wsId: string) => {
    if (!onSelectSavedWorksheet) return;
    setLoadingShelf(true);
    try {
      const list = await fetchFullShelfWorksheets([wsId]);
      if (list.length > 0) {
        onSelectSavedWorksheet(list[0]);
      }
    } catch (err: any) {
      alert('Failed to open worksheet: ' + err.message);
    } finally {
      setLoadingShelf(false);
    }
  };

  const handleBatchPrintShelf = async (mode: 'student' | 'key' | 'both', targetIds?: string[]) => {
    const idsToPrint = targetIds || selectedShelfIds;
    if (idsToPrint.length === 0 || !onBatchPrint) return;
    setLoadingShelf(true);
    try {
      const orderedIds = savedWorksheets
        .filter((w) => idsToPrint.includes(w.id))
        .map((w) => w.id);
      const list = await fetchFullShelfWorksheets(orderedIds.length > 0 ? orderedIds : idsToPrint);
      if (list.length > 0) {
        onBatchPrint(list, mode);
      }
    } catch (err: any) {
      alert('Batch print failed: ' + err.message);
    } finally {
      setLoadingShelf(false);
    }
  };

  const toggleShelfSelect = (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedShelfIds((prev) =>
      prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId]
    );
  };

  const fetchFolders = async () => {
    try {
      const { data } = await supabase.from('folders').select('name').order('name');
      const baseSet = new Set<string>([
        MATH6_POD_FOLDER,
        ACCELERATED_POD_FOLDER,
        ...(data ? data.map((f: any) => f.name) : []),
      ]);
      const names = Array.from(baseSet).sort();
      setFolders(names);
      if (!names.includes(selectedFolder)) {
        setSelectedFolder(MATH6_POD_FOLDER);
      }
    } catch {}
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      await supabase.from('folders').insert({ name: trimmed, teacher_id: teacherId || null });
    } catch {}
    if (!folders.includes(trimmed)) {
      setFolders((prev) => [...prev, trimmed].sort());
    }
    setSelectedFolder(trimmed);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  // 1. Prompt for Converting Existing Docs / Tests / PDFs
  const convertDocPrompt = `You are a middle school math curriculum assistant for Worksheet Maker 2.0. 
TASK: Extract all math problems from the attached document or text below into an OCR-ready worksheet format.
Return ONLY a valid JSON array wrapped in a single markdown code block (\`\`\`json ... \`\`\`):

[
  {
    "assignmentName": "Math 6 Quiz: Equations",
    "stylePreset": "quiz",
    "prompt": "Solve for $x$: $3x - 5 = 16$",
    "question_type": "numeric",
    "standard": "6.EE.B.7",
    "correct_answer": "7",
    "acceptable_alternatives": ["x = 7", "7"],
    "points": 2,
    "rubric_notes": "1 pt for subtracting/adding, 1 pt for division. [6.EE.B.7]"
  }
]

RULES:
- "stylePreset" must be one of: "pod" (6 questions, 1 page), "spiral" (6 questions, 1 page), "classwork" (6-10 questions, 1-2 pages), "quiz", or "exit_ticket" (2-3 questions).
- "question_type" must be one of: "numeric", "fraction", "expression", "multiple_choice", or "multi_step".
- "standard" must be the middle school NJSLS / Common Core math standard (e.g. "6.NS.C.7a", "6.EE.B.7", "5.NF.B.6", "7.RP.A.2").
- Wrap inline math expressions in $...$ delimiters (e.g. "Evaluate $3x^2 - 4.5$ when $x = 2.4$."). Keep English words like "when" outside the $...$ delimiters, and do not add raw \\quad spacing.
- For multiple choice, include "options": [{"label": "A", "text": "10"}, {"label": "B", "text": "12"}, {"label": "C", "text": "14"}, {"label": "D", "text": "16"}]. Keep each option text short and concise (under 8 words) so it does not crowd the student workspace box.
- Output ONLY the JSON array inside a \`\`\`json code block, with no conversational text or follow-up tags.`;

  // 2. Prompt for Generating Brand New Content
  const generateNewPrompt = `You are a middle school math curriculum generator for Worksheet Maker 2.0.
TASK: Generate high-quality math problems for middle school students on the requested topic.
Return ONLY a valid JSON array wrapped in a single markdown code block (\`\`\`json ... \`\`\`):

[
  {
    "assignmentName": "Math 6 POD Mon 10/26",
    "stylePreset": "pod",
    "prompt": "Solve for $x$: $\\frac{x}{3} + 4 = 10$",
    "question_type": "numeric",
    "standard": "6.EE.B.7",
    "correct_answer": "18",
    "acceptable_alternatives": ["x = 18", "18"],
    "points": 2,
    "rubric_notes": "1 pt for subtracting 4 (x/3 = 6), 1 pt for multiplying by 3. [6.EE.B.7]"
  }
]

RULES:
- Preset question counts: "pod" = EXACTLY 6 questions per day/assignment (1 page); "spiral" = EXACTLY 6 questions (1 page); "classwork" = 6-10 questions (1-2 pages); "quiz" = assessment; "exit_ticket" = 2-3 questions.
- "question_type" must be one of: "numeric", "fraction", "expression", "multiple_choice", or "multi_step".
- "standard" must be the middle school NJSLS / Common Core math standard (e.g. "6.NS.C.7a", "6.EE.B.7", "5.NF.B.6", "7.RP.A.2").
- Wrap inline math expressions in $...$ delimiters (e.g. "Evaluate $3x^2 - 4.5$ when $x = 2.4$."). Keep English words like "when" outside the $...$ delimiters, and do not add raw \\quad spacing.
- For multiple choice, include "options": [{"label": "A", "text": "10"}, {"label": "B", "text": "12"}, {"label": "C", "text": "14"}, {"label": "D", "text": "16"}]. Keep each option text short and concise (under 8 words) so it does not crowd the student workspace box.
- Output ONLY the JSON array inside a \`\`\`json code block, with no conversational text or follow-up tags.`;

  const handleCopy = (type: 'convert' | 'generate') => {
    const textToCopy = type === 'convert' ? convertDocPrompt : generateNewPrompt;
    navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // ROBUST PARSER: Isolates valid JSON bracket boundaries, strips markdown/follow-up tags,
  // cleans trailing commas, and safely escapes single backslashes for LaTeX
  const robustParseJson = (rawText: string): any => {
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '');

    // Extract exact JSON boundary [ ... ] or { ... } to ignore any text or <FollowUp> tags
    const firstArray = cleaned.indexOf('[');
    const firstObj = cleaned.indexOf('{');
    let start = -1;
    if (firstArray !== -1 && firstObj !== -1) start = Math.min(firstArray, firstObj);
    else start = firstArray !== -1 ? firstArray : firstObj;

    const lastArray = cleaned.lastIndexOf(']');
    const lastObj = cleaned.lastIndexOf('}');
    const end = Math.max(lastArray, lastObj);

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }

    // Clean trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    // Lookbehind regex: Only escapes a backslash if it is NOT preceded by a backslash
    // and NOT followed by a valid JSON escape char (" \ / b f n r t u)
    cleaned = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');

    return JSON.parse(cleaned);
  };

  const parseOptionsFromPrompt = (prompt: string) => {
    const mcRegex = /(?:^|\s+)([A-D])[\)\.]\s*([^A-D\)\.]+?)(?=\s+[A-D][\)\.]|$)/gi;
    const options: { label: string; text: string }[] = [];
    let match: RegExpExecArray | null;

    const firstMatchIdx = prompt.search(/(?:^|\s+)[A-D][\)\.]/i);
    const cleanPrompt = firstMatchIdx !== -1 ? prompt.substring(0, firstMatchIdx).trim() : prompt;

    while ((match = mcRegex.exec(prompt)) !== null) {
      options.push({
        label: match[1].toUpperCase(),
        text: match[2].trim(),
      });
    }

    return { cleanPrompt, options };
  };

  const convertRawItemsToQuestions = (items: any[]): { questions: Question[]; totalPages: 1 | 2 } => {
    const totalCount = items.length;
    const totalPages: 1 | 2 = totalCount > 6 ? 2 : 1;
    const perPageLimit = totalPages === 2 ? Math.ceil(totalCount / 2) : totalCount;

    const questions: Question[] = items.map((item, idx) => {
      let prompt = String(item.prompt || item.question || `Problem ${idx + 1}`);
      let options = item.options || [];
      let qType = item.question_type || 'numeric';

      if (qType === 'multiple_choice' && (!options || options.length === 0)) {
        const extracted = parseOptionsFromPrompt(prompt);
        if (extracted.options.length > 0) {
          prompt = extracted.cleanPrompt;
          options = extracted.options;
        }
      }

      const pageNumber = totalPages === 2 && idx >= perPageLimit ? 2 : 1;

      // Extract or infer standard
      let standard = item.standard || '';
      if (!standard && item.rubric_notes) {
        const stdMatch = String(item.rubric_notes).match(/([4-8]\.[A-Z]+\.[A-Z]+(?:\.[0-9a-zA-Z]+)?)/i);
        if (stdMatch) standard = stdMatch[1];
      }

      return {
        id: crypto.randomUUID(),
        order_index: idx + 1,
        page_number: pageNumber,
        prompt,
        question_type: qType,
        options,
        correct_answer: String(item.correct_answer || item.answer || ''),
        acceptable_alternatives: item.acceptable_alternatives || [],
        points: Number(item.points) || (qType === 'multi_step' ? 3 : 2),
        rubric_notes: item.rubric_notes || item.explanation || '',
        standard: standard || undefined,
      };
    });

    return { questions, totalPages };
  };

  const inferStylePreset = (title: string | undefined, items: any[]): StylePreset => {
    const explicit = String(items[0]?.stylePreset || items[0]?.style_preset || '').toLowerCase();
    if (
      explicit === 'pod' ||
      explicit === 'spiral' ||
      explicit === 'classwork' ||
      explicit === 'quiz' ||
      explicit === 'exit_ticket'
    ) {
      return explicit as StylePreset;
    }
    const lower = (title || '').toLowerCase();
    if (lower.includes('classwork')) return 'classwork';
    if (lower.includes('pod') || lower.includes('problem of the day')) return 'pod';
    if (lower.includes('quiz') || lower.includes('test') || lower.includes('assessment')) return 'quiz';
    if (lower.includes('exit')) return 'exit_ticket';
    return 'spiral';
  };

  const handleProcessImport = () => {
    setError(null);
    setDetectedGroups(null);
    const raw = inputText.trim();
    if (!raw) {
      setError('Please paste your questions or JSON into the box below.');
      return;
    }

    try {
      const parsed = robustParseJson(raw);
      const items: any[] = Array.isArray(parsed) ? parsed : parsed.questions || parsed.problems;

      if (Array.isArray(items) && items.length > 0) {
        // Check if there are multiple assignments bundled together (e.g. Mon, Tue, Wed...)
        const groupMap: { [key: string]: any[] } = {};
        for (const it of items) {
          const grpName = it.assignmentName || 'Main Assignment';
          if (!groupMap[grpName]) groupMap[grpName] = [];
          groupMap[grpName].push(it);
        }

        const groupKeys = Object.keys(groupMap);
        if (groupKeys.length > 1) {
          // Multiple assignments detected! Show assignment picker
          const groups: AssignmentGroup[] = groupKeys.map((name) => ({
            name,
            items: groupMap[name],
          }));
          // Auto-switch selectedFolder to Accelerated PODs or Math 6 PODs based on detected group titles
          const inferredFirstFolder = resolveWorksheetFolder(
            groups[0].name,
            selectedFolder,
            inferStylePreset(groups[0].name, groups[0].items)
          );
          if (inferredFirstFolder !== selectedFolder) {
            setSelectedFolder(inferredFirstFolder);
          }
          setDetectedGroups(groups);
          return;
        }

        // Single assignment
        const title = items[0]?.assignmentName || undefined;
        const stylePreset = inferStylePreset(title, items);
        const targetFolder = resolveWorksheetFolder(title, selectedFolder, stylePreset);
        const { questions, totalPages } = convertRawItemsToQuestions(items);

        onImportQuestions(questions, {
          title,
          stylePreset,
          totalPages,
          folderName: targetFolder,
        });
        return;
      }
    } catch (e: any) {
      console.error(e);
    }

    // 2. Fallback: Parse plain text numbered lists
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const questions: Question[] = [];
    let currentQ: Partial<Question> | null = null;
    let qCounter = 1;

    for (const line of lines) {
      const qMatch = line.match(/^(\d+)[\.\)]\s*(.*)/i) || line.match(/^question\s*(\d+)[:\.]?\s*(.*)/i) || line.match(/^problem\s*(\d+)[:\.]?\s*(.*)/i);
      const ansMatch = line.match(/^(?:ans|answer|correct|key)[:\s]+(.*)/i);

      if (qMatch) {
        if (currentQ && currentQ.prompt) {
          questions.push(finalizeQuestion(currentQ, qCounter++));
        }
        currentQ = {
          prompt: qMatch[2] || line,
          correct_answer: '',
          question_type: 'numeric',
          points: 2,
        };
      } else if (ansMatch && currentQ) {
        currentQ.correct_answer = ansMatch[1].trim();
      } else if (currentQ) {
        currentQ.prompt = (currentQ.prompt ? currentQ.prompt + ' ' : '') + line;
      } else {
        currentQ = {
          prompt: line,
          correct_answer: '',
          question_type: 'numeric',
          points: 2,
        };
      }
    }

    if (currentQ && currentQ.prompt) {
      questions.push(finalizeQuestion(currentQ, qCounter));
    }

    if (questions.length > 0) {
      onImportQuestions(questions, { folderName: selectedFolder });
    } else {
      setError('Could not parse the pasted text. Please verify the format or copy the AI prompt above.');
    }
  };

  const handleSelectGroup = (group: AssignmentGroup) => {
    const stylePreset = inferStylePreset(group.name, group.items);
    const targetFolder = resolveWorksheetFolder(group.name, selectedFolder, stylePreset);
    const { questions, totalPages } = convertRawItemsToQuestions(group.items);

    onImportQuestions(questions, {
      title: group.name,
      stylePreset,
      totalPages,
      folderName: targetFolder,
    });
  };

  // One-click batch save all assignments to Supabase! (Plus optional immediate Batch Print)
  const handleSaveAllGroups = async (andPrintMode?: 'student' | 'key' | 'both') => {
    if (!detectedGroups || detectedGroups.length === 0) return;
    setIsSavingAll(true);
    setSaveAllMessage(`Saving ${detectedGroups.length} assignments...`);

    const savedBatchWorksheets: Worksheet[] = [];
    const usedFolders = new Set<string>();

    try {
      for (const group of detectedGroups) {
        const grpPreset = inferStylePreset(group.name, group.items);
        const targetFolder = resolveWorksheetFolder(group.name, selectedFolder, grpPreset);
        usedFolders.add(targetFolder);
        const code = 'M' + Math.floor(1000 + Math.random() * 9000);
        const { questions, totalPages } = convertRawItemsToQuestions(group.items);

        const { data: wsData, error: wsError } = await supabase
          .from('worksheets')
          .insert({
            short_code: code,
            title: group.name,
            subject: 'Mathematics',
            grade_level: '6th Grade',
            folder_name: targetFolder,
            teacher_id: teacherId || null,
            style_preset: grpPreset,
            total_pages: totalPages,
            columns: 2,
            student_id_digits: 3,
            track_standards: true,
            layout_config: { columns: 2, spacing: 'balanced', track_standards: true },
          })
          .select('id')
          .single();

        if (wsError) throw wsError;

        if (wsData && wsData.id) {
          const qPayload = questions.map((q) => ({
            worksheet_id: wsData.id,
            order_index: q.order_index,
            page_number: q.page_number,
            prompt: q.prompt,
            question_type: q.question_type,
            options: q.options,
            correct_answer: q.correct_answer,
            acceptable_alternatives: q.acceptable_alternatives,
            points: q.points,
            rubric_notes: q.rubric_notes,
            standard: q.standard || null,
            bounding_box: {},
          }));
          await supabase.from('questions').insert(qPayload);
        }

        const fullWs: Worksheet = {
          id: wsData?.id || crypto.randomUUID(),
          short_code: code,
          title: group.name,
          subject: 'Mathematics',
          grade_level: '6th Grade',
          folder_name: targetFolder,
          style_preset: grpPreset,
          total_pages: totalPages,
          columns: 2,
          spacing: 'balanced',
          student_id_digits: 3,
          track_standards: true,
          layout_config: {
            border_style: 'solid',
            header_style: 'clean',
            show_dot_grid: false,
            columns: 2,
            spacing: 'balanced',
            show_honor_pledge: false,
            track_standards: true,
          },
          questions,
        };
        savedBatchWorksheets.push(fullWs);

        // Non-blocking background sync to Google Drive via permanent Apps Script Bridge
        (async () => {
          try {
            const sDoc = await generateWorksheetPDF(fullWs, { isAnswerKey: false });
            const kDoc = await generateWorksheetPDF(fullWs, { isAnswerKey: true });
            const baseName = `${code}_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const driveRes = await saveWorksheetToDrive(
              providerToken,
              targetFolder,
              sDoc.output('blob'),
              kDoc.output('blob'),
              baseName
            );
            if (wsData?.id && (driveRes.studentFileId || driveRes.keyFileId)) {
              await supabase
                .from('worksheets')
                .update({
                  layout_config: {
                    columns: 2,
                    spacing: 'balanced',
                    track_standards: true,
                    drive_student_file_id: driveRes.studentFileId,
                    drive_key_file_id: driveRes.keyFileId,
                  },
                })
                .eq('id', wsData.id);
            }
            if (driveRes.folderUrl && onDriveFolderSaved) {
              onDriveFolderSaved(driveRes.folderUrl);
            }
          } catch (dErr: any) {
            console.warn('Background Drive upload warning:', dErr);
            if (dErr?.message === 'DRIVE_AUTH_EXPIRED' && onDriveTokenExpired) {
              onDriveTokenExpired();
            }
          }
        })();
      }

      const folderSummary = Array.from(usedFolders).join(' & ');
      fetchSavedWorksheets();
      setSaveAllMessage(
        `🎉 Saved all ${detectedGroups.length} assignments to "${folderSummary}" (syncing PDFs to Google Drive in background)!`
      );
      setIsSavingAll(false);

      if (andPrintMode && onBatchPrint && savedBatchWorksheets.length > 0) {
        onBatchPrint(savedBatchWorksheets, andPrintMode);
      } else {
        setTimeout(() => {
          handleSelectGroup(detectedGroups[0]);
        }, 900);
      }
    } catch (err: any) {
      alert('Save all failed: ' + err.message);
      setIsSavingAll(false);
    }
  };

  const finalizeQuestion = (q: Partial<Question>, idx: number): Question => ({
    id: crypto.randomUUID(),
    order_index: idx,
    page_number: 1,
    prompt: q.prompt || `Problem ${idx}`,
    question_type: q.question_type || 'numeric',
    options: [],
    correct_answer: q.correct_answer || '',
    acceptable_alternatives: [],
    points: q.points || 2,
    rubric_notes: '',
  });

  return (
    <div className="max-w-4xl mx-auto w-full py-8 px-4 sm:px-6">
      {/* Hero Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100/80 text-blue-800 text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>INSTANT OCR WORKSHEET BUILDER</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Turn Any Test, Doc, or AI Output into an OCR Worksheet
        </h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
          Convert your existing PDFs or generate fresh curriculum problems in seconds. We format the fiducials, QR codes, and answer boxes automatically for automated grading.
        </p>
      </div>

      {/* MULTI-ASSIGNMENT BATCH DETECTOR MODAL / BANNER */}
      {detectedGroups && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-2xl p-6 shadow-md mb-6 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-blue-200 pb-3 gap-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-700 shrink-0" />
              <h3 className="font-extrabold text-slate-900 text-base">
                Found {detectedGroups.length} Daily Assignments in Your Paste!
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 hidden sm:inline">Save to:</span>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden cursor-pointer"
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleSaveAllGroups()}
                disabled={isSavingAll}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer flex items-center space-x-1"
              >
                <span>{isSavingAll ? 'Saving...' : `💾 Save All ${detectedGroups.length}`}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveAllGroups('student')}
                disabled={isSavingAll}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold shadow-xs transition cursor-pointer flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{`🖨️ Save & Print All ${detectedGroups.length} Student Copies`}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveAllGroups('both')}
                disabled={isSavingAll}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold shadow-xs transition cursor-pointer flex items-center space-x-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Save & Print All + Keys</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Click any day below to open and edit it individually, or click <strong>Save & Print All {detectedGroups.length}</strong> above to print the entire week in one single print job:
          </p>

          {saveAllMessage && (
            <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-lg">
              {saveAllMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {detectedGroups.map((grp) => (
              <div
                key={grp.name}
                onClick={() => handleSelectGroup(grp)}
                className="p-3.5 bg-white border border-blue-200 hover:border-blue-500 rounded-xl cursor-pointer hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                    ★ Problem of the Day
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition">
                    {grp.name}
                  </h4>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {grp.items.length} Questions • 1 Page
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>Open & Print</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUTO-SYNC PROGRESS / COMPLETION BANNER FROM PLANNER */}
      {autoSyncMessage && (
        <div
          className={`mb-6 p-4 rounded-2xl border-2 flex items-center justify-between gap-3 shadow-sm ${
            isAutoSyncing
              ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center space-x-2.5 text-xs sm:text-sm font-bold">
            {isAutoSyncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-600" /> : <Check className="w-4 h-4 shrink-0 text-emerald-600" />}
            <span>{autoSyncMessage}</span>
          </div>
          {!isAutoSyncing && (
            <button
              type="button"
              onClick={() => setAutoSyncMessage('')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer px-2 py-1"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* QUICK-ACCESS SAVED WORKSHEETS & MULTI-SELECT BATCH PRINT SHELF */}
      {savedWorksheets.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Saved Worksheets & Multi-Worksheet Batch Print
                </h3>
                <p className="text-[11px] text-slate-500">
                  Check multiple assignments below to print several worksheets at once, or click any card to open
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Folder Filter */}
              <select
                value={shelfFolder}
                onChange={(e) => setShelfFolder(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Folders ({savedWorksheets.length})</option>
                {Array.from(new Set(savedWorksheets.map((w) => w.folder_name || 'General')))
                  .sort()
                  .map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={onOpenSavedList}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
              >
                Full Library ({savedWorksheets.length}) ↗
              </button>
            </div>
          </div>

          {/* Batch Print Bar when items are checked on the home shelf */}
          {selectedShelfIds.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-200" />
                <span className="text-xs font-extrabold">
                  {selectedShelfIds.length} Worksheet{selectedShelfIds.length > 1 ? 's' : ''} Selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedShelfIds([])}
                  className="text-[11px] text-blue-200 hover:text-white underline ml-1 cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={loadingShelf}
                  onClick={() => handleBatchPrintShelf('student')}
                  className="px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-extrabold flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {loadingShelf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>Print {selectedShelfIds.length} Student Copies</span>
                </button>
                <button
                  type="button"
                  disabled={loadingShelf}
                  onClick={() => handleBatchPrintShelf('key')}
                  className="px-2.5 py-1.5 bg-amber-400 text-slate-950 hover:bg-amber-300 rounded-lg text-xs font-extrabold flex items-center space-x-1 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Print {selectedShelfIds.length} Keys</span>
                </button>
                <button
                  type="button"
                  disabled={loadingShelf}
                  onClick={() => handleBatchPrintShelf('both')}
                  className="px-2.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white border border-blue-400/40 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Both (Student + Key)</span>
                </button>
              </div>
            </div>
          )}

          {/* Grid of recent worksheets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {savedWorksheets
              .filter((w) => shelfFolder === 'ALL' || (w.folder_name || 'General') === shelfFolder)
              .slice(0, 12)
              .map((ws) => {
                const isChecked = selectedShelfIds.includes(ws.id);
                return (
                  <div
                    key={ws.id}
                    onClick={() => handleOpenSavedFromShelf(ws.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                      isChecked
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-300'
                        : 'bg-slate-50/70 hover:bg-blue-50/30 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <button
                        type="button"
                        onClick={(e) => toggleShelfSelect(ws.id, e)}
                        className="mt-0.5 text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                        title="Check to batch print multiple worksheets at once"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded">
                            {ws.short_code}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {ws.folder_name || 'General'}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                          {ws.title}
                        </h4>
                      </div>
                    </div>

                    <div
                      className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          disabled={loadingShelf}
                          onClick={() => handleBatchPrintShelf('student', [ws.id])}
                          className="px-2 py-0.5 bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded font-bold flex items-center space-x-1 transition cursor-pointer"
                          title="Print Student Copy right now"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          disabled={loadingShelf}
                          onClick={() => handleBatchPrintShelf('key', [ws.id])}
                          className="px-1.5 py-0.5 bg-white hover:bg-amber-500 hover:text-white text-amber-800 border border-amber-200 rounded font-semibold flex items-center space-x-0.5 transition cursor-pointer"
                          title="Print Answer Key right now"
                        >
                          <Key className="w-3 h-3" />
                          <span>Key</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenSavedFromShelf(ws.id)}
                        className="font-bold text-slate-600 hover:text-blue-700 flex items-center space-x-0.5 cursor-pointer"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* STEP 1: Two Prominent Copy Prompt Action Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
            1
          </span>
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
            Choose What You Want to Do with AI (ChatGPT, Claude, or Gemini)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card A: Convert Existing Document */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm mb-1">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Option A: Convert Existing Test / PDF</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Have an existing Word document or PDF test? Copy this prompt, attach your file in ChatGPT or Claude, and let AI extract the problems.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('convert')}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              {copiedType === 'convert' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedType === 'convert' ? 'Copied Prompt to Clipboard!' : 'Copy Prompt for Existing Doc'}</span>
            </button>
          </div>

          {/* Card B: Generate Brand New Problems */}
          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 transition flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-sm mb-1">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Option B: Generate Brand New Questions</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Need fresh problems? Copy this prompt into ChatGPT/Gemini and tell it what topic you need (e.g. *"6 two-step equations for 7th grade"*).
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('generate')}
              className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
            >
              {copiedType === 'generate' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedType === 'generate' ? 'Copied Prompt to Clipboard!' : 'Copy Prompt to Generate New'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 2: Large Paste Box & Conversion Trigger */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              Paste the AI Output or Questions Here
            </h3>
          </div>
          <span className="text-xs text-slate-400">Accepts Gemini/ChatGPT JSON or standard text</span>
        </div>

        {/* Folder Destination Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center space-x-2">
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700">Save to Folder:</span>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  📁 {f}
                </option>
              ))}
            </select>
          </div>

          {!isCreatingFolder ? (
            <button
              type="button"
              onClick={() => setIsCreatingFolder(true)}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center space-x-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setIsCreatingFolder(false);
                }}
                placeholder="New folder name..."
                className="px-2.5 py-1 bg-white text-xs border border-blue-400 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="px-1 text-slate-400 text-xs"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <textarea
          rows={8}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste what Gemini, ChatGPT, or Claude gives you here:\n\n[\n  {\n    "assignmentName": "Math 6 POD Mon 10/26",\n    "prompt": "Solve for x: 2x - 5 = 11",\n    "question_type": "numeric",\n    "correct_answer": "8"\n  }\n]`}
          className="w-full p-4 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 transition"
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleProcessImport}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center space-x-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
        >
          <span>Build My OCR Worksheet</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Alternate Secondary Paths */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500">
        <span>Or skip import:</span>
        <button
          type="button"
          onClick={onOpenBlank}
          className="flex items-center space-x-1 text-slate-700 hover:text-blue-600 underline"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Start with a blank worksheet</span>
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={onOpenSavedList}
          className="flex items-center space-x-1 text-slate-700 hover:text-blue-600 underline"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
          <span>Open a saved worksheet from folders</span>
        </button>
      </div>
    </div>
  );
};
