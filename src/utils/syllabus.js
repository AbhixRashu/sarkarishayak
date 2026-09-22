/**
 * syllabus.js — shared syllabus resolution helper
 *
 * Used by the job detail page to show the interactive "Syllabus & Exam Pattern"
 * popup without duplicating logic inside src/pages/syllabus/[slug].astro.
 *
 * Matching rules are intentionally the SAME as the syllabus page:
 *   1. Curated syllabus entry in syllabus.json whose id matches the job slug
 *   2. Curated entry whose organization matches the job organization
 *      (e.g. any SSC job → SSC CGL syllabus)
 *   3. Fallback: build a compact syllabus from the job's own examPattern data
 */
import syllabusData from '../data/syllabus.json';

function buildFallbackSyllabus(job, baseSlug) {
  const subjects = [];

  // Prefer real per-job exam pattern data when the pipeline captured it
  if (Array.isArray(job?.examPattern) && job.examPattern.length > 0) {
    for (const stage of job.examPattern) {
      const names = String(stage.subjects || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (names.length === 0) continue;
      subjects.push({
        name: `${stage.stage || 'Stage'} — ${names[0]} & Others`,
        tier: stage.stage || 'CBT',
        questions: stage.questions || 0,
        marks: stage.maxMarks || 0,
        topics: names,
      });
    }
  }

  // Generic competitive-exam structure as the last resort
  if (subjects.length === 0) {
    subjects.push(
      {
        name: 'General Intelligence & Reasoning',
        tier: 'Tier 1 / CBT',
        questions: 25,
        marks: 50,
        topics: ['Analogies & Classification', 'Coding-Decoding & Series', 'Blood Relations & Direction Sense', 'Syllogism & Venn Diagram', 'Puzzles & Seating Arrangement', 'Non-Verbal Reasoning'],
      },
      {
        name: 'Quantitative Aptitude & Mathematics',
        tier: 'Tier 1 / CBT',
        questions: 25,
        marks: 50,
        topics: ['Number System & Simplification', 'Percentage, Ratio & Proportion', 'Profit, Loss & Discount', 'Simple & Compound Interest', 'Time & Work, Time & Distance', 'Mensuration & Data Interpretation'],
      },
      {
        name: 'General Awareness & Current Affairs',
        tier: 'Tier 1 / CBT',
        questions: 25,
        marks: 50,
        topics: ['Current Affairs', 'Indian Polity & Constitution', 'History of India & National Movement', 'Geography', 'General Science', 'Government Schemes'],
      },
      {
        name: 'General Hindi & English Language',
        tier: 'Tier 1 / CBT',
        questions: 25,
        marks: 50,
        topics: ['Reading Comprehension & Cloze Test', 'Grammar, Spotting Errors & Sentence Correction', 'Synonyms, Antonyms & Idioms/Phrases', 'Vyakaran (Sandhi, Samas, Muhavare)', 'One Word Substitution & Vocabulary'],
      }
    );
  }

  const totalMarks = subjects.reduce((sum, s) => sum + (s.marks || 0), 0);

  return {
    id: baseSlug || job?.slug || 'govt-exam',
    exam: job?.title || job?.shortTitle || 'Govt Exam',
    organization: job?.organization || 'Govt of India',
    fullName: `${job?.title || job?.shortTitle || 'Govt'} Examination 2026`,
    level: job?.qualify || 'Competitive Level',
    tiers: Array.isArray(job?.examPattern) && job.examPattern.length > 0 ? job.examPattern.length : 1,
    totalMarks: totalMarks || 200,
    duration: Array.isArray(job?.examPattern) && job.examPattern[0]?.duration ? job.examPattern[0].duration : '90-120 Minutes',
    negativeMarking: '0.25 to 0.33 (1/3rd or 1/4th mark per incorrect answer)',
    subjects,
    books: [],
  };
}

export function resolveSyllabusForJob(job) {
  if (!job) return null;
  const baseSlug = String(job.slug || '').replace(/-20\d{2}$/, '').toLowerCase();
  const org = String(job.organization || '').toLowerCase();

  const match = syllabusData.find(ex => {
    const id = String(ex.id || '').toLowerCase();
    if (baseSlug && id && (baseSlug.includes(id) || id.includes(baseSlug))) return true;
    return Boolean(org && ex.organization && String(ex.organization).toLowerCase() === org);
  });

  const exam = match
    ? { ...match, id: baseSlug || match.id, exam: job.shortTitle || job.title || match.exam }
    : buildFallbackSyllabus(job, baseSlug);

  return {
    exam,
    syllabusUrl: `/syllabus/${baseSlug || job.slug}/`,
    hasCurated: Boolean(match),
  };
}
