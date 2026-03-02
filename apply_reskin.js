const fs = require('fs');

const filesToClean = [
    'src/components/dashboard/BlockOrganizer.tsx',
    'src/components/reporting/meta/MetaBlockReview.tsx',
    'src/components/reporting/meta/BlockReview.tsx',
    'src/components/reporting/ReportList.tsx',
    'src/components/dashboard/AthleteCalendarContainer.tsx',
    'src/components/dashboard/MasterProgramCalendar.tsx',
];

filesToClean.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace dark mode panels with clean rounded-3xl bento cards
    content = content.replace(/background:\s*'rgba\(255,255,255,0\.02\)'/g, "className: 'bg-white rounded-3xl shadow-sm border border-slate-100'");
    content = content.replace(/background:\s*'rgba\(15,\s*23,\s*42,\s*0\.4\)'/g, "background: 'var(--card-bg)'");
    content = content.replace(/background:\s*'rgba\(15,\s*23,\s*42,\s*0\.8\)'/g, "background: 'var(--card-bg)'");
    content = content.replace(/background:\s*'rgba\(0,0,0,0\.2\)'/g, "background: 'var(--secondary)'");
    content = content.replace(/background:\s*'rgba\(0,0,0,0\.4\)'/g, "background: 'var(--secondary)'");
    content = content.replace(/background:\s*'rgba\(6,\s*182,\s*212,\s*0\.1\)'/g, "background: 'var(--secondary)'");
    content = content.replace(/color:\s*'var\(--foreground\)'/g, "color: 'var(--primary)'");

    // Apply the user's specific top stat card colors:
    // We will look for elements representing E1RM or Days Out.
    // In BlockOrganizer, the Days Out div:
    content = content.replace(
        /({\/\* Days Out Counter \*\/}[\s\S]*?)<div style={{ textAlign: 'right' }}>/g,
        '$1<div className="bg-amber-200 rounded-3xl shadow-sm p-4 text-slate-900 border border-slate-100" style={{ textAlign: \'center\' }}>'
    );
    
    // Make Action Buttons fully rounded (pill)
    content = content.replace(/borderRadius:\s*'8px'/g, "borderRadius: '9999px'");
    content = content.replace(/borderRadius:\s*'6px'/g, "borderRadius: '1rem'");
    content = content.replace(/borderRadius:\s*'12px'/g, "borderRadius: '2rem'");
    
    // Pastel color replacements
    content = content.replace(/#06b6d4/ig, "#38bdf8"); // Cyan to Soft Blue
    content = content.replace(/#10b981/ig, "#34d399"); // Green to Mint
    content = content.replace(/#3b82f6/ig, "#38bdf8"); // Blue to Soft Blue
    content = content.replace(/#ef4444/ig, "#fb7185"); // Red to Coral
    content = content.replace(/#f59e0b/ig, "#fcd34d"); // Orange/Amber to Mustard

    fs.writeFileSync(file, content, 'utf8');
});
console.log('Applied script replacements');
