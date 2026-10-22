import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../constants/colors';

export interface ImageViewerItem {
  id?: string;
  localUri: string;
  fileName?: string;
}

interface Props {
  visible: boolean;
  images: ImageViewerItem[];
  initialIndex?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function ImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          x: initialIndex * SCREEN_WIDTH,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex]);

  if (!images || images.length === 0) return null;

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < images.length && index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Top Header / Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>

          {images.length > 1 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}

          <View style={{ width: 40 }} />
        </View>

        {/* Zoomable Image Carousel */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={{ flex: 1 }}
        >
          {images.map((item, idx) => (
            <View key={item.id || idx} style={styles.slideContainer}>
              {item.localUri ? (
                <ScrollView
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  centerContent
                  contentContainerStyle={styles.zoomContentContainer}
                >
                  <Image
                    source={{ uri: item.localUri }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </ScrollView>
              ) : (
                <View style={styles.zoomContentContainer}>
                  <Ionicons name="cloud-download-outline" size={48} color="rgba(255,255,255,0.4)" />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 }}>
                    Foto belum diunduh
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Bottom Hint / File Name */}
        <View style={styles.footerBar}>
          {images[currentIndex]?.fileName && (
            <Text style={styles.fileNameText} numberOfLines={1}>
              {images[currentIndex].fileName}
            </Text>
          )}
          <Text style={styles.hintText}>
            Cubit layar untuk memperbesar (zoom)
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  counterText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomContentContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  footerBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: Spacing.md,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  fileNameText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginBottom: 4,
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
  },
});
