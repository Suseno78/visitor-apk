import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '../constants/colors';
import { NoteAttachment } from '../types';
import { NotePhotoService } from '../storage/notePhotoService';

interface Props {
  attachments: NoteAttachment[];
  onAddPhotos: (newAttachments: NoteAttachment[]) => void;
  onRemovePhoto: (attachmentId: string) => void;
  onPressPhoto?: (index: number) => void;
  disabled?: boolean;
}

export function NoteAttachmentPicker({
  attachments,
  onAddPhotos,
  onRemovePhoto,
  onPressPhoto,
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handlePick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const picked = await NotePhotoService.pickPhotos();
      if (picked.length > 0) {
        onAddPhotos(picked);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ marginBottom: Spacing.xl }}>
      {/* Header section */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[Typography.label, { color: Colors.textSecondary }]}>
            Lampiran Foto
          </Text>
          {attachments.length > 0 && (
            <View
              style={{
                marginLeft: Spacing.sm,
                backgroundColor: Colors.primarySurface,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: Radius.pill,
              }}
            >
              <Text
                style={[
                  Typography.caption,
                  { color: Colors.primary, fontWeight: '700' },
                ]}
              >
                {attachments.length}
              </Text>
            </View>
          )}
        </View>

        {/* Add photo button */}
        <TouchableOpacity
          onPress={handlePick}
          disabled={disabled || loading}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.primarySurface,
            paddingHorizontal: Spacing.md,
            paddingVertical: 6,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons
                name="images-outline"
                size={16}
                color={Colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  Typography.bodySmall,
                  { color: Colors.primary, fontWeight: '600' },
                ]}
              >
                + Tambah Foto
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Thumbnails preview list */}
      {attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: Spacing.xs,
            gap: Spacing.md,
          }}
        >
          {attachments.map((item, idx) => (
            <View
              key={item.id}
              style={{
                position: 'relative',
                width: 76,
                height: 76,
                borderRadius: Radius.md,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.borderLight,
                overflow: 'hidden',
              }}
            >
              <TouchableOpacity
                onPress={() => onPressPhoto?.(idx)}
                disabled={!onPressPhoto}
                activeOpacity={0.8}
                style={{ width: '100%', height: '100%' }}
              >
                {item.localUri ? (
                  <Image
                    source={{ uri: item.localUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: Colors.card,
                    }}
                  >
                    <Ionicons name="image-outline" size={22} color={Colors.textTertiary} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Remove button */}
              <TouchableOpacity
                onPress={() => onRemovePhoto(item.id)}
                disabled={disabled}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={14} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: Colors.borderLight,
            borderStyle: 'dashed',
            borderRadius: Radius.md,
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: Colors.card,
          }}
        >
          <Text
            style={[
              Typography.caption,
              { color: Colors.textTertiary, textAlign: 'center' },
            ]}
          >
            Belum ada lampiran foto untuk catatan ini.
          </Text>
        </View>
      )}
    </View>
  );
}
