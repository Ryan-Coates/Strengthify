package com.strengthify.data.model

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Relation

/** Per-lift all-time best estimated 1RM. Primary key is the lift name. */
@Entity(tableName = "personal_best")
data class PersonalBest(
    @PrimaryKey val lift: String,    // Lift.name
    val estimatedOneRmKg: Float,
    val achievedDate: String,        // "YYYY-MM-DD"
)

/** Room relation: one session + its sets, used for history queries. */
data class WorkoutSessionWithSets(
    @Embedded val session: WorkoutSession,
    @Relation(
        parentColumn = "id",
        entityColumn = "sessionId"
    )
    val sets: List<SetEntry>,
)
