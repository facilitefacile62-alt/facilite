package com.facilite.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.facilite.app.ui.FaciliteApp
import com.facilite.app.ui.theme.FaciliteTheme
import com.facilite.app.ui.theme.ScreenBackground

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FaciliteTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = ScreenBackground
                ) {
                    FaciliteApp()
                }
            }
        }
    }
}
