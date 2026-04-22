package com.strengthify.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class AchievementId(val displayName: String, val description: String, val emoji: String) {
    FIRST_WORKOUT       ("First Blood",           "Complete your first workout",                  "⚔️"),
    FIRST_PERSONAL_BEST ("Personal Record",        "Set your first personal best",                "🏅"),
    TRIPLE_STREAK       ("On a Roll",              "Work out 3 days in a row",                    "🔁"),
    WEEK_STREAK         ("Week Warrior",           "Work out 7 days in a row",                    "🔥"),
    MONTH_STREAK        ("Iron Habit",             "Work out 30 days in a row",                   "🗓️"),
    REACHED_NOVICE      ("Novice Lifter",          "Reach Novice tier on any lift",               "🔵"),
    REACHED_INTERMEDIATE("Intermediate Lifter",    "Reach Intermediate tier on any lift",         "🟢"),
    REACHED_ADVANCED    ("Advanced Lifter",        "Reach Advanced tier on any lift",             "🟡"),
    REACHED_ELITE       ("Elite Athlete",          "Reach Elite tier on any lift",                "🔴"),
    ALL_LIFTS_TRAINED   ("Full Roster",            "Log every one of the 8 lifts at least once",  "🏋️"),
    LEVEL_5             ("Seasoned",               "Reach Level 5",                               "⭐"),
    LEVEL_10            ("Veteran",                "Reach Level 10",                              "🌟"),
    HUNDRED_SETS        ("Century",                "Log 100 total sets",                           "💯"),
    THOUSAND_XP         ("XP Hunter",              "Earn 1,000 total XP",                         "✨"),
}

@Entity(tableName = "achievement")
data class Achievement(
    @PrimaryKey val id: String,        // AchievementId.name
    val earnedDate: String,            // "YYYY-MM-DD"
)
