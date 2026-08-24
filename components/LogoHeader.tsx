import { View, Image } from 'react-native';

interface Props {
  size?: number;
  showText?: boolean;
}

export function LogoHeader({ size = 32 }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        source={require('../assets/v-removebg-preview.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}
