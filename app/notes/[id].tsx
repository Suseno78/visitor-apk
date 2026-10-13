import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius, Shadows } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { useNotes } from '../../hooks/useNotes';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Note } from '../../types';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getNote, deleteNote } = useNotes();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    const data = await getNote(id);
    if (data) {
      setNote(data);
    } else {
      Alert.alert('Error', 'Catatan tidak ditemukan', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!note) return;
    setShowDeleteModal(false);
    setIsDeleting(true);

    const success = await deleteNote(note.id);
    setIsDeleting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('Error', 'Gagal menghapus catatan');
    }
  };

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setViewerVisible(true);
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!note) return null;

  const formattedCreated = new Date(note.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const attachments = note.attachments || [];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Detail Catatan',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: Typography.h3,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 16, marginRight: 16 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.xxl + 20,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content Card */}
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.xl,
            padding: Spacing.xl,
            marginBottom: Spacing.xl,
            borderWidth: 1,
            borderColor: Colors.borderLight,
            ...Shadows.card,
          }}
        >
          {/* Note Title */}
          <Text
            style={[
              Typography.h2,
              { color: Colors.textPrimary, marginBottom: Spacing.xs },
            ]}
          >
            {note.title}
          </Text>

          {/* Date / Metadata */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: Spacing.lg,
              paddingBottom: Spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: Colors.borderLight,
            }}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={Colors.textTertiary}
              style={{ marginRight: 6 }}
            />
            <Text style={[Typography.caption, { color: Colors.textTertiary }]}>
              {formattedCreated}
            </Text>
          </View>

          {/* Note Content Text */}
          <Text
            style={[
              Typography.body,
              {
                color: Colors.textPrimary,
                lineHeight: 24,
                marginBottom: attachments.length > 0 ? Spacing.xl : 0,
              },
            ]}
          >
            {note.content}
          </Text>

          {/* Attached Images Section */}
          {attachments.length > 0 && (
            <View
              style={{
                marginTop: Spacing.md,
                paddingTop: Spacing.lg,
                borderTopWidth: 1,
                borderTopColor: Colors.borderLight,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: Spacing.md,
                }}
              >
                <Ionicons
                  name="images-outline"
                  size={16}
                  color={Colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[Typography.label, { color: Colors.textSecondary }]}>
                  Lampiran Foto ({attachments.length})
                </Text>
              </View>

              {/* Thumbnail Grid / Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.md }}
              >
                {attachments.map((item, index) => (
                  <TouchableOpacity
                    key={item.id || index}
                    activeOpacity={0.8}
                    onPress={() => handleImagePress(index)}
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: Radius.md,
                      backgroundColor: Colors.background,
                      borderWidth: 1,
                      borderColor: Colors.borderLight,
                      overflow: 'hidden',
                    }}
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
                        <Ionicons name="cloud-download-outline" size={24} color={Colors.textTertiary} />
                        <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: 2, fontSize: 9 }]}>
                          Belum diunduh
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        backgroundColor: 'rgba(0, 0, 0, 0.55)',
                        borderRadius: 10,
                        padding: 3,
                      }}
                    >
                      <Ionicons name="expand-outline" size={12} color={Colors.white} />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text
                style={[
                  Typography.caption,
                  { color: Colors.textTertiary, marginTop: Spacing.sm },
                ]}
              >
                Ketuk foto untuk melihat pratinjau layar penuh (zoom)
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons Below Content */}
        <View style={{ gap: Spacing.md }}>
          <PrimaryButton
            title="Edit Catatan"
            icon="create-outline"
            onPress={() => router.push(`/notes/edit?id=${note.id}`)}
            disabled={isDeleting}
          />

          <PrimaryButton
            title="Hapus Catatan"
            icon="trash-outline"
            variant="outline"
            color={Colors.danger}
            onPress={() => setShowDeleteModal(true)}
            disabled={isDeleting}
          />
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Hapus Catatan"
        message="Yakin ingin menghapus catatan ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        destructive={true}
      />

      {/* Fullscreen Zoomable Image Viewer Modal */}
      <ImageViewerModal
        visible={viewerVisible}
        images={attachments}
        initialIndex={selectedImageIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}
