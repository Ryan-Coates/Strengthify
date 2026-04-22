package com.strengthify.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "workout_session")
data class WorkoutSession(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: String,          // "YYYY-MM-DD"
    val totalXpEarned: Int = 0,
    val durationMins: Int = 0,
)
