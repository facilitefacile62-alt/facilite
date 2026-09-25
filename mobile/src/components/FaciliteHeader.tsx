import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import PanneauMenuProfil from '@/components/PanneauMenuProfil';
import PanneauNotifications from '@/components/PanneauNotifications';

interface FaciliteHeaderProps {
  dark?: boolean;
}

export default function FaciliteHeader({ dark = false }: FaciliteHeaderProps) {
  const router = useRouter();
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  const bg = dark ? '#0B0E14' : '#FFFFFF';
  const border = dark ? '#1E2638' : 'rgba(0,0,0,0.06)';
  const iconColor = dark ? '#F1F5F9' : '#1E293B';

  return (
    <View style={{ backgroundColor: bg, borderBottomWidth: 1, borderColor: border }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 12,
        }}>
        <Pressable
          onPress={() => router.replace('/')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Image source={require('@/assets/images/logo-cle.png')} alt="Facilité" style={{ width: 15, height: 30 }} contentFit="contain" />
          </View>
          <Text
            style={{
              color: dark ? '#FFFFFF' : '#2563EB',
              fontSize: 20,
              fontWeight: '900',
              letterSpacing: -0.3,
            }}>
            Facilité
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Recherche */}
          <Pressable
            onPress={() => router.push('/recherche')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: dark ? '#161B26' : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: dark ? '#1E2638' : 'transparent',
            }}>
            <Ionicons name="search" size={18} color={iconColor} />
          </Pressable>

          {/* Notifications avec badge rouge */}
          <Pressable
            onPress={() => setNotifsOuvertes(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: dark ? '#161B26' : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              borderWidth: 1,
              borderColor: dark ? '#1E2638' : 'transparent',
            }}>
            <Ionicons name="notifications-outline" size={18} color={iconColor} />
            <View
              style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#EF4444',
              }}
            />
          </Pressable>

          {/* Menu Hamburger */}
          <Pressable
            onPress={() => setMenuOuvert(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: dark ? '#161B26' : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: dark ? '#1E2638' : 'transparent',
            }}>
            <Ionicons name="menu" size={20} color={iconColor} />
          </Pressable>
        </View>
      </View>

      <PanneauNotifications visible={notifsOuvertes} onFermer={() => setNotifsOuvertes(false)} />
      <PanneauMenuProfil visible={menuOuvert} onFermer={() => setMenuOuvert(false)} />
    </View>
  );
}
