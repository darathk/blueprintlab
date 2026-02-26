const fs = require('fs');

const files = [
    'src/components/athlete/ScheduleView.tsx',
    'src/app/athlete/[id]/workout/[sessionId]/workout-logger.tsx'
];

const colorMap = {
    // Backgrounds
    "'#e2e8f0'": "'transparent'", // Outer background
    "'#fff'": "'var(--background)'", // Inner cards
    "'#f8fafc'": "'var(--card-bg)'", // Alternating cards
    "'#f1f5f9'": "'var(--card-bg)'", // Actual column bg
    "'#1e3a8a'": "'rgba(6, 182, 212, 0.1)'", // Dark blue Headers -> subtle cyan tint for Neon theme
    "'var(--brand-dark-blue, #1e3a8a)'": "'rgba(6, 182, 212, 0.15)'", // Accordion header

    // Text
    "'#0f172a'": "'var(--foreground)'",
    "'#334155'": "'var(--foreground)'",
    "'#475569'": "'var(--secondary-foreground)'",
    "'#64748b'": "'var(--secondary-foreground)'",
    "'#2563eb'": "'var(--primary)'",

    // Borders
    "'#cbd5e1'": "'var(--card-border)'",
    "'#e2e8f0'": "'var(--card-border)'", // when used as border
    "'#94a3b8'": "'var(--card-border)'",

    // Accents / Status
    "'#10b981'": "'var(--success)'",
    "'#34d399'": "'var(--success)'",
    "'#fbbf24'": "'var(--warning)'",
    "'#d97706'": "'var(--warning)'",
    "'#3b82f6'": "'var(--primary)'"
};

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Specifically handle the string replacement
    // Need to handle both single and double quotes occasionally used
    for (const [oldColor, newColor] of Object.entries(colorMap)) {
        const regex = new RegExp(oldColor, 'g');
        content = content.replace(regex, newColor);
    }

    // Let's also replace double quote versions just in case
    for (const [oldColor, newColor] of Object.entries(colorMap)) {
        const dOld = oldColor.replace(/'/g, '"');
        const dNew = newColor.replace(/'/g, '"');
        const regex = new RegExp(dOld, 'g');
        content = content.replace(regex, dNew);
    }

    fs.writeFileSync(file, content);
    console.log(`Updated colors in ${file}`);
});
