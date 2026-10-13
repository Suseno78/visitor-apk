import { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { useNotes } from '../../hooks/useNotes';
import { FormInput } from '../../components/FormInput';
import { FormTextArea } from '../../components/FormTextArea';
import { NoteAttachmentPicker } from '../../components/NoteAttachmentPicker';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { Ionicons } from '@expo/vector-icons';
import { NoteAttachment } from '../../types';

export default function AddNoteScreen() {
  const { addNote } = useNotes();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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
    
    const now = new Date().toISOString();
    const success = await addNote({
      id: Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
      attachments,
    });

    setIsSubmitting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('Error', 'Gagal menyimpan catatan');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Tambah Catatan',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: Typography.h3,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16, marginRight: 16 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
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
          onPressPhoto={(idx) => {
            setSelectedImageIndex(idx);
            setViewerVisible(true);
          }}
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

      <ImageViewerModal
        visible={viewerVisible}
        images={attachments}
        initialIndex={selectedImageIndex}
        onClose={() => setViewerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}
