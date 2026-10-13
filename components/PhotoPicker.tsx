import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/colors';
import { PhotoService } from '../storage/photoService';

interface Props {
  visitorId?: string;
  photoUri: string | null;
  onPhotoSelected: (uri: string) => void;
  onPhotoRemoved: () => void;
}

export function PhotoPicker({ visitorId, photoUri, onPhotoSelected, onPhotoRemoved }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    setLoading(true);
    try {
      const pickerUri = await PhotoService.pickPhoto();
      if (pickerUri) {
        // If we have a visitorId, process and save immediately
        if (visitorId) {
          const savedUri = await PhotoService.processAndSave(visitorId, pickerUri);
          onPhotoSelected(savedUri);
        } else {
          // For new visitors (no ID yet), pass the raw picker URI
          // It will be processed after the visitor is saved
          onPhotoSelected(pickerUri);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal memilih foto. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Hapus Foto',
      'Yakin ingin menghapus foto profil?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            if (visitorId) {
              PhotoService.deletePhoto(visitorId);
            }
            onPhotoRemoved();
          },
        },
      ]
    );
  };

  const size = 100;

  return (
    <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
      {/* Photo Circle */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: Colors.primarySurface,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 3,
          borderColor: Colors.primary,
          marginBottom: Spacing.md,
        }}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: size, height: size }}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="person" size={44} color={Colors.primary} />
        )}
      </View>

      {/* Buttons */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <TouchableOpacity
          onPress={handlePick}
          disabled={loading}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.primarySurface,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.pill,
            borderWidth: 1,
            borderColor: Colors.primary,
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Ionicons
            name={photoUri ? 'camera-outline' : 'image-outline'}
            size={16}
            color={Colors.primary}
            style={{ marginRight: 6 }}
          />
          <Text style={[Typography.buttonSmall, { color: Colors.primary }]}>
            {loading ? 'Memproses...' : photoUri ? 'Ganti Foto' : 'Pilih Foto'}
          </Text>
        </TouchableOpacity>

        {photoUri && (
          <TouchableOpacity
            onPress={handleRemove}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.dangerLight,
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.pill,
            }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.danger} style={{ marginRight: 4 }} />
            <Text style={[Typography.buttonSmall, { color: Colors.danger }]}>Hapus</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
