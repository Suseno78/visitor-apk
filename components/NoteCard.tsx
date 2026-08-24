import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing, Shadows } from '../constants/colors';
import { Note } from '../types';

interface Props {
  note: Note;
  onPress: () => void;
}

export function NoteCard({ note, onPress }: Props) {
  // Format date to locale string
  const formattedDate = new Date(note.updatedAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.card, Shadows.card]}
    >
      <View style={styles.header}>
        <Text style={[Typography.h4, styles.title]} numberOfLines={1}>
          {note.title}
        </Text>
        <Text style={[Typography.caption, styles.date]}>{formattedDate}</Text>
      </View>
      
      <Text style={[Typography.body, styles.content]} numberOfLines={2}>
        {note.content}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  date: {
    color: Colors.textTertiary,
  },
  content: {
    color: Colors.textSecondary,
    lineHeight: 20,
  }
});
