package com.facilite.app.ui.screens.messages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.Conversation
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@Composable
fun MessagesScreen(
    conversations: List<Conversation> = MockDataRepository.conversations,
    onConversationClick: (Conversation) -> Unit = {}
) {
    var selectedFilter by remember { mutableStateOf("Toutes") }
    val filters = listOf("Toutes", "Non lues", "Offres", "Support", "Stages")

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // En-tête : Titre Discussions + badge + actions
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Discussions",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(MintGreen)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "4",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = null,
                    tint = TextPrimary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        // Champ de recherche
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .clip(PillShape)
                    .background(CardSurface)
                    .border(1.dp, Color(0x14000000), PillShape)
                    .padding(horizontal = 16.dp, vertical = 11.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "Rechercher ou démarrer une discussion...",
                        fontSize = 13.sp,
                        color = TextMuted
                    )
                }
            }
        }

        // Filtres horizontaux (Pilules)
        item {
            LazyRow(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filters) { filter ->
                    val isActive = selectedFilter == filter
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(if (isActive) TextPrimary else CardSurface)
                            .border(
                                1.dp,
                                if (isActive) Color.Transparent else Color(0x14000000),
                                PillShape
                            )
                            .clickable { selectedFilter = filter }
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = filter,
                            fontSize = 12.5.sp,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (isActive) Color.White else TextPrimary
                        )
                    }
                }
            }
        }

        // Liste des conversations
        items(conversations) { conv ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CardSurface)
                    .clickable { onConversationClick(conv) }
                    .padding(horizontal = 16.dp, vertical = 13.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Avatar / Badge
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(if (conv.isSupport) Color(0xFFE8F8F1) else RoyalBlue.copy(alpha = 0.15f))
                            .border(
                                1.5.dp,
                                if (conv.isSupport) MintGreen else RoyalBlue,
                                CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (conv.isSupport) {
                            Icon(
                                imageVector = Icons.Default.Shield,
                                contentDescription = null,
                                tint = MintGreen,
                                modifier = Modifier.size(20.dp)
                            )
                        } else {
                            Text(
                                text = conv.partnerName.take(2).uppercase(),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = RoyalBlue
                            )
                        }
                    }

                    Column(
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = conv.partnerName,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = conv.timestamp,
                                fontSize = 11.5.sp,
                                color = TextMuted
                            )
                        }

                        Text(
                            text = conv.lastMessage,
                            fontSize = 12.5.sp,
                            color = TextSecondary,
                            maxLines = 1,
                            modifier = Modifier.padding(top = 3.dp)
                        )
                    }

                    if (conv.unreadCount > 0) {
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .clip(CircleShape)
                                .background(MintGreen),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = conv.unreadCount.toString(),
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
