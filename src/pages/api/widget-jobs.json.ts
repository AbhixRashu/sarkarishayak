---
// Generates /widget/jobs.json at build time
// CORS-friendly static JSON for the embeddable widget
import latestJobs from '../../data/latest-jobs.json';

const today = new Date();

const activeJobs = (latestJobs as any[])
  .filter((job: any) => {
    const d = new Date(job.lastDate);
    return !isNaN(d.getTime()) && d >= today;
  })
  .slice(0, 5)
  .map((job: any) => ({
    title: job.shortTitle || (job.title as string)?.substring(0, 55) || job.title,
    department: job.organization || job.department || '',
    slug: job.slug,
    lastDate: job.lastDate,
  }));

export async function GET() {
  return new Response(JSON.stringify(activeJobs), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
---
