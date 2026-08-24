import { useState, useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { useNotes } from '../../hooks/useNotes';
import { FormInput } from '../../components/FormInput';
import { FormTextArea } from '../../components/FormTextArea';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Ionicons } from '@expo/vector-icons';

export default function EditNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getNote, updateNote, deleteNote } = useNotes();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const note = await getNote(id);
      if (note) {
        setTitle(note.title);
        setContent(note.content);
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
      router.back();
    } else {
      Alert.alert('Error', 'Gagal menghapus catatan');
    }
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

        <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl }}>
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
    </KeyboardAvoidingView>
  );
}
