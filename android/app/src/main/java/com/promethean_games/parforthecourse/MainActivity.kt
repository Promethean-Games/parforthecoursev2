package com.promethean_games.parforthecourse

import android.os.Bundle
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this).apply {
            setPadding(32, 32, 32, 32)
        }

        val label = TextView(this).apply {
            text = "Par for the Course"
            textSize = 20f
        }

        root.addView(label)
        setContentView(root)
    }
}
