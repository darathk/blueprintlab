export const EXERCISE_CATEGORIES = {
    KNEE: "Knee",
    HIP: "Hip",
    PUSH_HORIZONTAL: "Horizontal Push",
    PUSH_VERTICAL: "Vertical Push",
    PULL_HORIZONTAL: "Horizontal Pull",
    PULL_VERTICAL: "Vertical Pull",
    ISOLATION_UPPER: "Isolation (Upper)",
    ISOLATION_LOWER: "Isolation (Lower)",
    ISOLATION: "Isolation/Accessory" // Fallback
};

// Structure: Name -> { category, parent }
// Parent is used for "Variation Impact" report
export const EXERCISE_DB = {
    // Knee
    "Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Front Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Split Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Goblet Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Hack Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Leg Press": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Bulgarian Split Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "High Bar Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Pin Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },
    "Pause Squat": { category: EXERCISE_CATEGORIES.KNEE, parent: "Squat" },

    // Hip
    "Deadlift": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Sumo Deadlift": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Romanian Deadlift": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Stiff Leg Deadlift": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Good Morning": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Hip Thrust": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Back Extension": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Kettlebell Swing": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Pause Deadlift": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },
    "Deficit Deadlift": { category: EXERCISE_CATEGORIES.HIP, parent: "Deadlift" },

    // Push Horizontal
    "Bench Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Push Up": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Dumbbell Bench Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Incline Bench Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Floor Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Spoto Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Close Grip Bench Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },
    "Larsen Press": { category: EXERCISE_CATEGORIES.PUSH_HORIZONTAL, parent: "Bench Press" },

    // Push Vertical
    "Overhead Press": { category: EXERCISE_CATEGORIES.PUSH_VERTICAL, parent: "Overhead Press" },
    "Military Press": { category: EXERCISE_CATEGORIES.PUSH_VERTICAL, parent: "Overhead Press" },
    "Dumbbell Shoulder Press": { category: EXERCISE_CATEGORIES.PUSH_VERTICAL, parent: "Overhead Press" },
    "Handstand Push Up": { category: EXERCISE_CATEGORIES.PUSH_VERTICAL, parent: "Overhead Press" },
    "Dips": { category: EXERCISE_CATEGORIES.PUSH_VERTICAL, parent: "Overhead Press" },
    "Push Press": { category: EXERCISE_CATEGORIES.PUSH_VERTICAL, parent: "Overhead Press" },

    // Pull Horizontal
    "Barbell Row": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },
    "Dumbbell Row": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },
    "Seated Cable Row": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },
    "Face Pull": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },
    "Seal Row": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },
    "Chest Supported Row": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },
    "Pendlay Row": { category: EXERCISE_CATEGORIES.PULL_HORIZONTAL, parent: "Row" },

    // Pull Vertical
    "Pull Up": { category: EXERCISE_CATEGORIES.PULL_VERTICAL, parent: "Pull Up" },
    "Chin Up": { category: EXERCISE_CATEGORIES.PULL_VERTICAL, parent: "Pull Up" },
    "Lat Pulldown": { category: EXERCISE_CATEGORIES.PULL_VERTICAL, parent: "Pull Up" },

    // Isolation
    "Bicep Curl": { category: EXERCISE_CATEGORIES.ISOLATION_UPPER, parent: "Isolation" },
    "Tricep Extension": { category: EXERCISE_CATEGORIES.ISOLATION_UPPER, parent: "Isolation" },
    "Lateral Raise": { category: EXERCISE_CATEGORIES.ISOLATION_UPPER, parent: "Isolation" },
    "Leg Curl": { category: EXERCISE_CATEGORIES.ISOLATION_LOWER, parent: "Isolation" },
    "Leg Extension": { category: EXERCISE_CATEGORIES.ISOLATION_LOWER, parent: "Isolation" },
    "Calf Raise": { category: EXERCISE_CATEGORIES.ISOLATION_LOWER, parent: "Isolation" },
};

export function getExerciseCategory(name) {
    if (EXERCISE_DB[name]) return EXERCISE_DB[name].category;
    // Partial Match logic
    const lowerName = name.toLowerCase();
    if (lowerName.includes("squat") || lowerName.includes("lunge") || lowerName.includes("leg press")) return EXERCISE_CATEGORIES.KNEE;
    if (lowerName.includes("deadlift") || lowerName.includes("hinge") || lowerName.includes("good morning")) return EXERCISE_CATEGORIES.HIP;
    if (lowerName.includes("bench") || lowerName.includes("push up")) return EXERCISE_CATEGORIES.PUSH_HORIZONTAL;
    if (lowerName.includes("overhead") || lowerName.includes("press") || lowerName.includes("dip")) return EXERCISE_CATEGORIES.PUSH_VERTICAL;
    if (lowerName.includes("row")) return EXERCISE_CATEGORIES.PULL_HORIZONTAL;
    if (lowerName.includes("pull up") || lowerName.includes("pulldown") || lowerName.includes("chin up")) return EXERCISE_CATEGORIES.PULL_VERTICAL;

    // Isolation Heuristics
    if (lowerName.includes("curl") || lowerName.includes("tricep") || lowerName.includes("lateral") || lowerName.includes("raise") || lowerName.includes("face pull")) return EXERCISE_CATEGORIES.ISOLATION_UPPER;
    if (lowerName.includes("leg ext") || lowerName.includes("leg curl") || lowerName.includes("calf") || lowerName.includes("glute")) return EXERCISE_CATEGORIES.ISOLATION_LOWER;

    return EXERCISE_CATEGORIES.ISOLATION;
}

export function getParentLift(name) {
    if (EXERCISE_DB[name]) return EXERCISE_DB[name].parent;
    // Default fallback based on simple string matching
    const category = getExerciseCategory(name);
    if (category === EXERCISE_CATEGORIES.KNEE) return "Squat";
    if (category === EXERCISE_CATEGORIES.HIP) return "Deadlift";
    if (category === EXERCISE_CATEGORIES.PUSH_HORIZONTAL) return "Bench Press";
    if (category === EXERCISE_CATEGORIES.PUSH_VERTICAL) return "Overhead Press";
    return name;
}
