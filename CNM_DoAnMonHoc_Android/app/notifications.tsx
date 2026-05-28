import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import SafeScreen from '@/components/safe-screen';
import { API_BASE_URL } from '@/constants/api';
import { getApiErrorMessage } from '@/services/http';

type NotificationSettings = {
  messageEnabled: boolean;
  groupEnabled: boolean;
  friendEnabled: boolean;
  callEnabled: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  messageEnabled: true,
  groupEnabled: true,
  friendEnabled: true,
  callEnabled: true,
};

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/notifications/settings`);
      setSettings({ ...DEFAULT_SETTINGS, ...(res.data || {}) });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);

    try {
      await axios.put(`${API_BASE_URL}/api/notifications/settings`, next);
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the cap nhat cai dat'));
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const registerPlaceholderToken = async () => {
    try {
      await axios.post(`${API_BASE_URL}/api/notifications/token`, { token: 'mobile-placeholder-token', platform: 'android' });
      alert('Da gui token test len server');
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the dang ky token'));
    }
  };

  const removePlaceholderToken = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/api/notifications/token`, { data: { token: 'mobile-placeholder-token' } });
      alert('Da go token test');
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Khong the go token'));
    }
  };

  if (loading) {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <View style={styles.container}>
        <Text style={styles.header}>Thong bao</Text>
        <Text style={styles.subtitle}>Cai dat thong bao truoc khi tich hop FCM full</Text>

        <View style={styles.card}>
          <SettingRow label="Tin nhan" value={settings.messageEnabled} onChange={(value) => void updateSetting('messageEnabled', value)} />
          <SettingRow label="Nhom" value={settings.groupEnabled} onChange={(value) => void updateSetting('groupEnabled', value)} />
          <SettingRow label="Ban be" value={settings.friendEnabled} onChange={(value) => void updateSetting('friendEnabled', value)} />
          <SettingRow label="Cuoc goi" value={settings.callEnabled} onChange={(value) => void updateSetting('callEnabled', value)} />
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={registerPlaceholderToken}>
          <Ionicons name="notifications" size={18} color="#fff" />
          <Text style={styles.actionText}>Dang ky token test</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={removePlaceholderToken}>
          <Ionicons name="close-circle" size={18} color="#fff" />
          <Text style={styles.actionText}>Go token test</Text>
        </TouchableOpacity>

        {saving && <Text style={styles.savingText}>Dang luu cai dat...</Text>}
      </View>
    </SafeScreen>
  );
}

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} thumbColor={value ? '#3b82f6' : '#cbd5e1'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingTop: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { color: '#0f172a', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#64748b', marginTop: 6, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowLabel: { color: '#1e293b', fontWeight: '700' },
  actionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  actionBtnSecondary: { backgroundColor: '#64748b' },
  actionText: { color: '#fff', fontWeight: '700' },
  savingText: { marginTop: 4, color: '#475569', fontWeight: '600' },
});
