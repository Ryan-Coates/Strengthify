package com.strengthify.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Single-row entity (id always = 1).
 * Dates stored as ISO-8601 strings ("YYYY-MM-DD") to avoid binary type converters.
 */
@Entity(tableName = "user_profile")
data class UserProfile(
    @PrimaryKey val id: Int = 1,
    val name: String,
    val sex: String,           // Sex.name
    val ageYears: Int,
    val bodyweightKg: Float,
    val totalXp: Int = 0,
    val level: Int = 1,
    val currentStreak: Int = 0,
    val lastWorkoutDate: String? = null,  // "YYYY-MM-DD"
)
