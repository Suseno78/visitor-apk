import { useState, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { useNotes } from '../../hooks/useNotes';
import { FormInput } from '../../components/FormInput';
import { FormTextArea } from '../../components/FormTextArea';
import { NoteAttachmentPicker } from '../../components/NoteAttachmentPicker';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Ionicons } from '@expo/vector-icons';
import { NoteAttachment } from '../../types';

export default function EditNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getNote, updateNote, deleteNote } = useNotes();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const note = await getNote(id);
      if (note) {
        setTitle(note.title);
        setContent(note.content);
        setAttachments(note.attachments || []);
      } else {
        Alert.alert('Error', 'Catatan tidak ditemukan', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
      setIsLoading(false);
    };
    
    if (id) loadData();
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Judul catatan tidak boleh kosong');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Error', 'Isi catatan tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    
    const success = await updateNote(id, {
      title: title.trim(),
      content: content.trim(),
      attachments,
    });

    setIsSubmitting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('Error', 'Gagal memperbarui catatan');
    }
  };

  const handleDelete = async () => {
    setShowDeleteModal(false);
    setIsSubmitting(true);
    
    const success = await deleteNote(id);
    
    setIsSubmitting(false);

    if (success) {
      // Navigate back to notes list
      router.replace('/notes');
    } else {
      Alert.alert('Error', 'Gagal menghapus catatan');
    }
  };

  const handlePhotoPress = (index: number) => {
    setSelectedImageIndex(index);
    setViewerVisible(true);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Edit Catatan',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: Typography.h3,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16, marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={{ marginRight: 16 }}>
              <Ionicons name="trash-outline" size={22} color={Colors.white} />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView 
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.xxl,
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <FormInput
          label="Judul Catatan"
          value={title}
          onChangeText={setTitle}
          placeholder="Masukkan judul..."
        />
        
        <FormTextArea
          label="Isi Catatan"
          value={content}
          onChangeText={setContent}
          placeholder="Tulis catatan Anda di sini..."
        />

        <NoteAttachmentPicker
          attachments={attachments}
          onAddPhotos={(newAtts) => setAttachments((prev) => [...prev, ...newAtts])}
          onRemovePhoto={(attId) =>
            setAttachments((prev) => prev.filter((a) => a.id !== attId))
          }
          onPressPhoto={handlePhotoPress}
          disabled={isSubmitting}
        />

        <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title="Batal"
              onPress={() => router.back()}
              variant="outline"
              disabled={isSubmitting}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title="Simpan"
              onPress={handleSave}
              disabled={isSubmitting}
            />
          </View>
        </View>
      </ScrollView>

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

      <ImageViewerModal
        visible={viewerVisible}
        images={attachments}
        initialIndex={selectedImageIndex}
        onClose={() => setViewerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}
