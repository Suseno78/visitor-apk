import { View, Text } from 'react-native';
import { VisitorCategory } from '../types';
import { Colors, Radius } from '../constants/colors';

interface Props {
  category: VisitorCategory;
}

export function CategoryBadge({ category }: Props) {
  const bg = Colors.categoryBg[category] || Colors.categoryBg.Reguler;
  const fg = Colors.category[category] || Colors.category.Reguler;

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          color: fg,
        }}
      >
        {category}
      </Text>
    </View>
  );
}
