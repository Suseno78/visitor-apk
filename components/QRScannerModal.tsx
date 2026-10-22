import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/colors';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (token: string) => Promise<boolean>;
}

export function QRScannerModal({ visible, onClose, onScanSuccess }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;
    setScanned(true);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Validate payload JSON structure
      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch {
        throw new Error('Format QR Code tidak valid.');
      }

      if (!payload || payload.type !== 'visitra_pair' || !payload.token) {
        throw new Error('QR Code bukan kode pairing Visitra yang valid.');
      }

      // 2. Pass token to consumer
      const success = await onScanSuccess(payload.token);
      if (!success) {
        setScanned(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses QR Code.');
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setScanned(false);
    setIsProcessing(false);
    setErrorMessage(null);
    onClose();
  };

  const handleReset = () => {
    setScanned(false);
    setErrorMessage(null);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Pairing</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Permission Check */}
        {!permission ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerContainer}>
            <Ionicons name="camera-outline" size={60} color={Colors.textTertiary} />
            <Text style={[Typography.h3, { color: Colors.textPrimary, marginTop: Spacing.md, textAlign: 'center' }]}>
              Izin Kamera Diperlukan
            </Text>
            <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', marginHorizontal: Spacing.xl }]}>
              Visitra membutuhkan akses kamera untuk memindai kode QR dari perangkat utama.
            </Text>
            <View style={{ marginTop: Spacing.xl, width: '80%' }}>
              <PrimaryButton title="Izinkan Kamera" onPress={requestPermission} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />

            {/* Viewfinder Target Box Overlay */}
            <View style={styles.overlay}>
              <View style={styles.targetFrame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>

              <Text style={styles.instructionText}>
                Arahkan kamera ke QR Code di perangkat utama
              </Text>

              {isProcessing && (
                <View style={styles.processingCard}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[Typography.bodySmall, { color: Colors.textPrimary, marginLeft: Spacing.sm }]}>
                    Menghubungkan ke workspace...
                  </Text>
                </View>
              )}

              {errorMessage && (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                  <Text style={[Typography.bodySmall, { color: Colors.danger, marginLeft: Spacing.sm, flex: 1 }]}>
                    {errorMessage}
                  </Text>
                  <TouchableOpacity onPress={handleReset} style={{ marginLeft: Spacing.sm }}>
                    <Text style={[Typography.label, { color: Colors.primary }]}>Coba Lagi</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.white,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  targetFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.primaryLight,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  instructionText: {
    ...Typography.bodySmall,
    color: Colors.white,
    marginTop: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  processingCard: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  errorCard: {
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderColor: Colors.danger,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
});
