import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '../constants/colors';
import { VisitAttachment } from '../types';
import { VisitPhotoService } from '../storage/visitPhotoService';

interface Props {
  attachments: VisitAttachment[];
  onAddPhotos: (newAttachments: VisitAttachment[]) => void;
  onRemovePhoto: (attachmentId: string) => void;
  onPressPhoto?: (index: number) => void;
  disabled?: boolean;
  maxPhotos?: number;
}

export function VisitAttachmentPicker({
  attachments,
  onAddPhotos,
  onRemovePhoto,
  onPressPhoto,
  disabled = false,
  maxPhotos = 5,
}: Props) {
  const [loading, setLoading] = useState(false);

  // Active attachments (excluding soft-deleted)
  const activeAttachments = attachments.filter((att) => !att.deletedAt);
  const isMaxReached = activeAttachments.length >= maxPhotos;

  const handlePick = async () => {
    if (disabled || loading || isMaxReached) return;
    setLoading(true);
    try {
      const picked = await VisitPhotoService.pickPhotos(activeAttachments.length, maxPhotos);
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
            Foto / Bukti Kunjungan
          </Text>
          <View
            style={{
              marginLeft: Spacing.sm,
              backgroundColor: isMaxReached ? Colors.dangerLight : Colors.primarySurface,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: Radius.pill,
            }}
          >
            <Text
              style={[
                Typography.caption,
                { color: isMaxReached ? Colors.danger : Colors.primary, fontWeight: '700' },
              ]}
            >
              {activeAttachments.length}/{maxPhotos}
            </Text>
          </View>
        </View>

        {/* Add photo button */}
        {!isMaxReached && (
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
                  name="camera-outline"
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
        )}
      </View>

      {/* Thumbnails preview list */}
      {activeAttachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: Spacing.xs,
            gap: Spacing.md,
          }}
        >
          {activeAttachments.map((item, idx) => (
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
                    <Ionicons
                      name="image-outline"
                      size={28}
                      color={Colors.textTertiary}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Remove button */}
              {!disabled && (
                <TouchableOpacity
                  onPress={() => onRemovePhoto(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={14} color={Colors.white} />
                </TouchableOpacity>
              )}
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
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: Colors.card,
          }}
        >
          <Ionicons name="images-outline" size={24} color={Colors.textTertiary} />
          <Text
            style={[
              Typography.caption,
              { color: Colors.textTertiary, marginTop: 4 },
            ]}
          >
            Belum ada foto bukti kunjungan
          </Text>
        </View>
      )}
    </View>
  );
}
