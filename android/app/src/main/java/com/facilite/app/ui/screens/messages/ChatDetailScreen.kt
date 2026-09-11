package com.facilite.app.ui.screens.messages

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.ChatMessage
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@Composable
fun ChatDetailScreen(
    partnerName: String = "Support RH Facilité",
    onBackClick: () -> Unit = {}
) {
    var messages by remember { mutableStateOf(MockDataRepository.sampleChatMessages) }
    var draftText by remember { mutableStateOf("") }
    var chatMenuOpen by remember { mutableStateOf(false) }
    var quickActionsOpen by remember { mutableStateOf(false) }
    var isRecording by remember { mutableStateOf(false) }
    var aiModalOpen by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // 1. En-tête de la discussion
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CardSurface)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                IconButton(
                    onClick = onBackClick,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Retour",
                        tint = TextPrimary
                    )
                }

                // Avatar FC
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(MintGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "FC",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = partnerName,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "en ligne · Facilité",
                        fontSize = 11.sp,
                        color = MintGreen
                    )
                }

                // Menu ⋮
                IconButton(
                    onClick = { chatMenuOpen = !chatMenuOpen },
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "Options",
                        tint = TextPrimary
                    )
                }
            }

            // Menu contextuel ⋮ (Réponses de l'IA)
            AnimatedVisibility(visible = chatMenuOpen) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .wrapContentSize(Alignment.TopEnd)
                        .padding(end = 14.dp, top = 4.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        shadowElevation = 8.dp,
                        color = CardSurface,
                        modifier = Modifier.width(200.dp)
                    ) {
                        Column(modifier = Modifier.padding(6.dp)) {
                            Text(
                                text = "Réponses de l'IA",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        chatMenuOpen = false
                                        aiModalOpen = true
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                            )
                            Text(
                                text = "Infos sur la discussion",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { chatMenuOpen = false }
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                            )
                        }
                    }
                }
            }

            // 2. Liste des bulles de messages
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(messages) { msg ->
                    ChatBubble(message = msg)
                }
            }

            // 3. Barre d'actions rapides IA
            AnimatedVisibility(visible = quickActionsOpen) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFF1A1A1A),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .padding(start = 14.dp, bottom = 8.dp)
                        .width(260.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(
                            text = "ACTIONS RAPIDES IA",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0x80FFFFFF),
                            letterSpacing = 0.5.sp,
                            modifier = Modifier.padding(bottom = 6.dp)
                        )
                        QuickActionRow(
                            label = "Tarifs & Modèles CV Facilité",
                            iconBg = MintGreen,
                            onClick = {
                                quickActionsOpen = false
                                messages = messages + ChatMessage(
                                    id = "msg_${messages.size + 1}",
                                    text = "Quels sont les tarifs et modèles de CV disponibles ?",
                                    isFromMe = true,
                                    timestamp = "14:22"
                                )
                            }
                        )
                        QuickActionRow(
                            label = "Conseils Recrutement Sénégal",
                            iconBg = RoyalBlue,
                            onClick = { quickActionsOpen = false }
                        )
                    }
                }
            }

            // 4. Barre de saisie inférieure (Mode Dictée vs Mode Texte)
            Surface(
                color = CardSurface,
                shadowElevation = 4.dp
            ) {
                if (isRecording) {
                    // Mode Enregistrement Vocal avec minuteur
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Annuler",
                            tint = RedAlert,
                            modifier = Modifier
                                .size(20.dp)
                                .clickable { isRecording = false }
                        )
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(RedAlert)
                        )
                        Text(
                            text = "0:02",
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )

                        // Onde sonore simulée
                        Row(
                            modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            listOf(6, 12, 18, 24, 14, 8, 20, 16, 22, 10, 15, 8).forEach { h ->
                                Box(
                                    modifier = Modifier
                                        .width(2.5.dp)
                                        .height(h.dp)
                                        .clip(RoundedCornerShape(2.dp))
                                        .background(Color(0x40000000))
                                )
                            }
                        }

                        // Bouton envoyer audio
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(TextPrimary)
                                .clickable {
                                    isRecording = false
                                    messages = messages + ChatMessage(
                                        id = "msg_${messages.size + 1}",
                                        text = "🎤 Message vocal (0:02)",
                                        isFromMe = true,
                                        timestamp = "14:23",
                                        audioDurationSeconds = 2
                                    )
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "Envoyer",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                } else {
                    // Saisie texte normale
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Bouton + Actions rapides
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(ScreenBackground)
                                .clickable { quickActionsOpen = !quickActionsOpen },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Actions",
                                tint = TextPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        OutlinedTextField(
                            value = draftText,
                            onValueChange = { draftText = it },
                            placeholder = {
                                Text(
                                    text = "Posez une question ou demandez un conseil CV...",
                                    fontSize = 12.5.sp,
                                    color = TextMuted
                                )
                            },
                            modifier = Modifier.weight(1f),
                            shape = PillShape,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = ScreenBackground,
                                unfocusedContainerColor = ScreenBackground,
                                focusedBorderColor = Color.Transparent,
                                unfocusedBorderColor = Color.Transparent
                            )
                        )

                        // Bouton Micro pour basculer en enregistrement
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MintGreen)
                                .clickable {
                                    if (draftText.isNotBlank()) {
                                        messages = messages + ChatMessage(
                                            id = "msg_${messages.size + 1}",
                                            text = draftText,
                                            isFromMe = true,
                                            timestamp = "14:24"
                                        )
                                        draftText = ""
                                    } else {
                                        isRecording = true
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (draftText.isNotBlank()) Icons.Default.Send else Icons.Default.Mic,
                                contentDescription = "Action",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(message: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.isFromMe) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (message.isFromMe) 16.dp else 4.dp,
                        bottomEnd = if (message.isFromMe) 4.dp else 16.dp
                    )
                )
                .background(
                    if (message.isFromMe) RoyalBlue
                    else if (message.isAiSuggested) Color(0xFFE8F8F1)
                    else CardSurface
                )
                .padding(12.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = message.text,
                    fontSize = 13.5.sp,
                    color = if (message.isFromMe) Color.White else TextPrimary,
                    lineHeight = 18.sp
                )
                Text(
                    text = message.timestamp,
                    fontSize = 10.sp,
                    color = if (message.isFromMe) Color(0xB2FFFFFF) else TextMuted,
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }
    }
}

@Composable
private fun QuickActionRow(
    label: String,
    iconBg: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 8.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(iconBg)
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White
        )
    }
}
