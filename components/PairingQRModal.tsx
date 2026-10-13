import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  workspaceName?: string | null;
}

export function PairingQRModal({ visible, onClose, workspaceName }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const fetchToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_pairing_token');
      if (rpcError) {
        throw new Error(rpcError.message || 'Gagal membuat token pairing di server.');
      }

      if (!data) {
        throw new Error('Data pairing tidak diterima.');
      }

      // Safe row extraction: handle both array-of-rows and single-row object
      const row: any = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;

      if (!row) {
        throw new Error('Data pairing tidak diterima.');
      }

      // Extract token string
      let receivedToken = '';
      if (typeof row === 'string') {
        receivedToken = row;
      } else if (typeof row === 'object' && row !== null) {
        if (typeof row.token === 'string') {
          receivedToken = row.token;
        } else if (typeof row.p_token === 'string') {
          receivedToken = row.p_token;
        }
      }

      if (!receivedToken || receivedToken.trim() === '') {
        throw new Error('Token pairing tidak valid.');
      }

      // Extract expires_at timestamp
      let receivedExpiry = new Date(Date.now() + 5 * 60 * 1000); // default fallback: 5 minutes
      if (typeof row === 'object' && row !== null && row.expires_at) {
        const parsed = new Date(row.expires_at);
        if (!isNaN(parsed.getTime())) {
          receivedExpiry = parsed;
        }
      }

      setToken(receivedToken);
      setExpiresAt(receivedExpiry);
      setSecondsRemaining(Math.max(0, Math.floor((receivedExpiry.getTime() - Date.now()) / 1000)));
    } catch (err: any) {
      setError(err.message || 'Gagal membuat QR pairing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchToken();
    } else {
      setToken(null);
      setExpiresAt(null);
      setSecondsRemaining(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    if (!expiresAt) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  const isExpired = secondsRemaining <= 0 && !loading && token !== null;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Compact payload structure
  const qrPayload = JSON.stringify({
    v: 1,
    type: 'visitra_pair',
    token: token || '',
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Top Bar */}
          <View style={styles.modalHeader}>
            <Text style={[Typography.h3, { color: Colors.textPrimary }]}>
              Tambah Perangkat
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[Typography.bodySmall, { color: Colors.textSecondary, marginBottom: Spacing.lg }]}>
            Scan kode QR ini menggunakan perangkat lain untuk menghubungkannya ke workspace{' '}
            <Text style={{ fontWeight: '600', color: Colors.primary }}>{workspaceName || 'Visitra'}</Text>.
          </Text>

          {/* QR Display Area */}
          <View style={styles.qrContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={[Typography.bodySmall, { color: Colors.textTertiary, marginTop: Spacing.sm }]}>
                  Membuat kode pairing...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
                <Text style={[Typography.bodySmall, { color: Colors.danger, marginTop: Spacing.sm, textAlign: 'center' }]}>
                  {error}
                </Text>
                <TouchableOpacity onPress={fetchToken} style={{ marginTop: Spacing.md }}>
                  <Text style={[Typography.label, { color: Colors.primary }]}>Coba Lagi</Text>
                </TouchableOpacity>
              </View>
            ) : isExpired ? (
              <View style={styles.expiredContainer}>
                <Ionicons name="time-outline" size={48} color={Colors.textTertiary} />
                <Text style={[Typography.body, { color: Colors.textSecondary, marginTop: Spacing.sm, fontWeight: '600' }]}>
                  Kode QR Telah Kedaluwarsa
                </Text>
                <Text style={[Typography.caption, { color: Colors.textTertiary, marginTop: 4, textAlign: 'center' }]}>
                  Untuk keamanan, kode pairing hanya berlaku selama 5 menit.
                </Text>
                <View style={{ marginTop: Spacing.lg, width: '100%' }}>
                  <PrimaryButton title="Buat QR Baru" onPress={fetchToken} />
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={styles.qrBox}>
                  <QRCode
                    value={qrPayload}
                    size={200}
                    color={Colors.primaryDark}
                    backgroundColor={Colors.white}
                  />
                </View>

                {/* Countdown Badge */}
                <View style={styles.timerBadge}>
                  <Ionicons name="timer-outline" size={16} color={Colors.warning} />
                  <Text style={[Typography.caption, { color: Colors.textSecondary, marginLeft: 6, fontWeight: '600' }]}>
                    Berlaku: <Text style={{ color: Colors.warning }}>{formatCountdown(secondsRemaining)}</Text>
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Footer Info */}
          <Text style={[Typography.caption, { color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.md }]}>
            Kode ini bersifat sementara dan hanya dapat digunakan sekali.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  qrContainer: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  qrBox: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    ...Shadows.card,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  expiredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    width: '100%',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
});
