package com.facilite.app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.LanguageSkill
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileLanguagesScreen(
    onNavigateBack: () -> Unit,
    onTabSelected: (String) -> Unit = {}
) {
    val languages = remember {
        mutableStateListOf(
            *MockDataRepository.userProfile.languages.toTypedArray(),
            LanguageSkill("Wolof", "Langue maternelle / Courant", 100),
            LanguageSkill("Arabe", "Notions de base", 35)
        )
    }

    var showAddDialog by remember { mutableStateOf(false) }
    var newLangName by remember { mutableStateOf("") }
    var newLangLevel by remember { mutableStateOf("Intermédiaire (B2)") }
    var newLangPercentage by remember { mutableFloatStateOf(60f) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Langues & Compétences",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = TextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Retour",
                            tint = TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ScreenBackground)
            )
        },
        containerColor = ScreenBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Profile Sub-navigation tabs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ProfileTabChip("À propos", isSelected = false) { onTabSelected("a-propos") }
                ProfileTabChip("Infos perso", isSelected = false) { onTabSelected("infos-perso") }
                ProfileTabChip("Langues", isSelected = true) { onTabSelected("langues") }
                ProfileTabChip("Expériences", isSelected = false) { onTabSelected("experiences") }
                ProfileTabChip("Formation", isSelected = false) { onTabSelected("formation") }
            }

            // Header Banner
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = RoyalBlue),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Translate,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Maîtrise linguistique",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            "Les profils multilingues ont 3x plus d'opportunités d'embauche.",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            // Language List Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardSurface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Langues déclarées (${languages.size})",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TextPrimary
                        )

                        Button(
                            onClick = { showAddDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Ajouter", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    languages.forEachIndexed { index, lang ->
                        LanguageItemRow(
                            language = lang,
                            onDelete = { languages.removeAt(index) }
                        )
                        if (index < languages.size - 1) {
                            HorizontalDivider(color = BorderLight, thickness = 1.dp)
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = {
                Text("Ajouter une langue", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = newLangName,
                        onValueChange = { newLangName = it },
                        label = { Text("Nom de la langue (ex: Espagnol)") },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = newLangLevel,
                        onValueChange = { newLangLevel = it },
                        label = { Text("Niveau (ex: Professionnel / C1)") },
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text(
                        "Niveau de maîtrise : ${newLangPercentage.toInt()}%",
                        fontSize = 12.sp,
                        color = TextMuted
                    )
                    Slider(
                        value = newLangPercentage,
                        onValueChange = { newLangPercentage = it },
                        valueRange = 10f..100f,
                        colors = SliderDefaults.colors(
                            thumbColor = RoyalBlue,
                            activeTrackColor = RoyalBlue
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newLangName.isNotBlank()) {
                            languages.add(
                                LanguageSkill(
                                    name = newLangName,
                                    level = newLangLevel,
                                    percentage = newLangPercentage.toInt()
                                )
                            )
                            newLangName = ""
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue)
                ) {
                    Text("Ajouter")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Annuler", color = TextMuted)
                }
            }
        )
    }
}

@Composable
fun LanguageItemRow(
    language: LanguageSkill,
    onDelete: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Default.Language,
                    contentDescription = null,
                    tint = RoyalBlue,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = language.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = TextPrimary
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = language.level,
                    fontSize = 12.sp,
                    color = TextMuted
                )
                IconButton(
                    onClick = onDelete,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        Icons.Default.DeleteOutline,
                        contentDescription = "Supprimer",
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        LinearProgressIndicator(
            progress = { language.percentage / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = if (language.percentage > 70) MintGreen else RoyalBlue,
            trackColor = BorderLight
        )
    }
}
