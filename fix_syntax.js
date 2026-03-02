const fs = require('fs');
const filesToFix = [
    'src/components/dashboard/BlockOrganizer.tsx',
    'src/components/reporting/meta/MetaBlockReview.tsx',
    'src/components/reporting/meta/BlockReview.tsx',
    'src/components/reporting/ReportList.tsx',
    'src/components/dashboard/AthleteCalendarContainer.tsx',
    'src/components/dashboard/MasterProgramCalendar.tsx',
];

filesToFix.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    // We accidentally injected `className:` into the style object. Let's just remove it and let it be default background, or replace it with `background: 'var(--card-bg)'`
    content = content.replace(/,\s*className:\s*'bg-white rounded-3xl shadow-sm border border-slate-100'/g, ", background: 'var(--card-bg)'");
    content = content.replace(/className:\s*'bg-white rounded-3xl shadow-sm border border-slate-100'\s*,/g, "background: 'var(--card-bg)', ");
    content = content.replace(/className:\s*'bg-white rounded-3xl shadow-sm border border-slate-100'/g, "background: 'var(--card-bg)'");

    fs.writeFileSync(file, content, 'utf8');
});
console.log('Fixed syntax errors');
