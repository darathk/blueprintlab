const fs = require('fs');

const files = [
    'src/components/reporting/ReportWizard.tsx',
    'src/components/reporting/ReportList.tsx',
    'src/components/reporting/meta/MetaBlockReview.tsx',
    'src/components/reporting/meta/StressBalanceReport.tsx',
    'src/components/reporting/meta/CompetitionLiftHeatMap.tsx',
    'src/components/reporting/meta/BlockAnalysisTable.tsx',
    'src/components/reporting/meta/AssistCorrelationTable.tsx',
    'src/components/reporting/meta/BlockReview.tsx',
    'src/components/analytics/CompStats.tsx',
    'src/components/analytics/BlockImprovements.tsx',
    'src/components/analytics/LiftDensity.tsx',
    'src/app/dashboard/athletes/[id]/reports/page.tsx',
    'src/app/dashboard/athletes/[id]/programs/[programId]/review/page.tsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace glass-panel with solid-panel
    content = content.replace(/className="glass-panel"/g, 'className="solid-panel"');
    
    // Replace card with solid-panel
    content = content.replace(/className="card"/g, 'className="solid-panel"');
    
    // Replace var(--card-bg) with #111111
    content = content.replace(/var\(--card-bg\)/g, '#111111');
    
    fs.writeFileSync(file, content);
});
console.log("Done");
