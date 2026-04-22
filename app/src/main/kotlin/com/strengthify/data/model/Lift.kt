package com.strengthify.data.model

enum class Lift(val displayName: String, val muscleGroup: String) {
    BACK_SQUAT("Back Squat",          "Quads / Glutes"),
    DEADLIFT("Deadlift",              "Posterior Chain"),
    BENCH_PRESS("Bench Press",        "Chest / Triceps"),
    OVERHEAD_PRESS("Overhead Press",  "Shoulders"),
    BARBELL_ROW("Barbell Row",        "Upper Back"),
    PULL_UP("Pull-up / Chin-up",      "Lats / Biceps"),
    DIP("Dip",                        "Chest / Triceps"),
    ROMANIAN_DEADLIFT("Romanian Deadlift", "Hamstrings"),
}

enum class Sex { MALE, FEMALE }

enum class BenchmarkTier(val label: String, val emoji: String) {
    BEGINNER("Beginner",         "🟤"),
    NOVICE("Novice",             "🔵"),
    INTERMEDIATE("Intermediate", "🟢"),
    ADVANCED("Advanced",         "🟡"),
    ELITE("Elite",               "🔴"),
}
