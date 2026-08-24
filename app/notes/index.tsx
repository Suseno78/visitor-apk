import { useCallback } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Typography } from '../../constants/colors';
import { useResponsive } from '../../constants/layout';
import { useNotes } from '../../hooks/useNotes';
import { SearchBar } from '../../components/SearchBar';
import { NoteCard } from '../../components/NoteCard';
import { EmptyState } from '../../components/EmptyState';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function NotesScreen() {
  const { notes, searchQuery, setSearchQuery, loadNotes } = useNotes();
  const { horizontalPadding, isTablet, contentMaxWidth } = useResponsive();

  // Reload notes when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const handleAddPress = () => {
    router.push('/notes/add');
  };

  const handleNotePress = (id: string) => {
    router.push(`/notes/${id}`);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Catatan',
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

      {/* Search Header */}
      <View
        style={{
          paddingHorizontal: horizontalPadding,
          paddingVertical: Spacing.md,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.borderLight,
        }}
      >
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari catatan..."
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}
        />
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NoteCard note={item} onPress={() => handleNotePress(item.id)} />
        )}
        contentContainerStyle={{
          padding: horizontalPadding,
          paddingTop: Spacing.md,
          paddingBottom: 100, // Make room for FAB
          ...(isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : {}),
        }}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title={searchQuery ? 'Pencarian Tidak Ditemukan' : 'Belum Ada Catatan'}
            description={
              searchQuery
                ? `Tidak ada catatan yang cocok dengan "${searchQuery}"`
                : 'Mulai dengan menambahkan catatan baru.'
            }
          />
        }
      />

      <FloatingActionButton onPress={handleAddPress} bottom={40} />
    </KeyboardAvoidingView>
  );
}
