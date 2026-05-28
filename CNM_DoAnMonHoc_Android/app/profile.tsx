import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { useUserContext } from '@/context/user-context';
import SafeScreen from '@/components/safe-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { clearSession } from '@/services/session-storage';
import NotificationsService, { removePushTokenOnLogout } from '@/services/notifications';

export default function ProfileScreen({ user }: any) {
  const { user: contextUser, setUser } = useUserContext();
  const activeUser = user || contextUser;
  const activeUsername = activeUser?.username;
  const [profile, setProfile] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ displayName: '', phone: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeUsername) return;
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/users/${activeUsername}`)
      .then(res => {
        setProfile(res.data);
        setForm({ displayName: res.data.displayName || '', phone: res.data.phone || '' });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [activeUsername]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/users/update`, {
        username: activeUsername,
        displayName: form.displayName,
        phone: form.phone,
      });
      setEditMode(false);
      setProfile((p: any) => ({ ...p, ...form }));
    } catch {
      alert('Lỗi cập nhật!');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Remove saved push token on backend if present
      const token = (NotificationsService as any)?._lastToken || null;
      if (token) {
        await removePushTokenOnLogout(token);
      }
    } catch (e) {
      console.warn('Error removing push token on logout', e);
    }

    await clearSession();
    setUser(null);
  };

  if (loading) return (
    <SafeScreen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    </SafeScreen>
  );

  if (!profile) return (
    <SafeScreen>
      <View style={styles.container}>
        <Text style={styles.errorText}>Không tìm thấy hồ sơ</Text>
      </View>
    </SafeScreen>
  );

  return (
    <SafeScreen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header with Avatar */}
        <View style={styles.headerCard}>
          <Ionicons name="person-circle" size={80} color="#3b82f6" />
          <Text style={styles.userName}>{profile.displayName || profile.username}</Text>
          <Text style={styles.userHandle}>@{profile.username}</Text>
        </View>

        {editMode ? (
          <>
            {/* Edit Mode */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Chỉnh sửa hồ sơ</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tên hiển thị</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person" size={20} color="#3b82f6" style={{ marginLeft: 12 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Tên hiển thị"
                    placeholderTextColor="#cbd5e1"
                    value={form.displayName}
                    onChangeText={t => setForm(f => ({ ...f, displayName: t }))}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Số điện thoại</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call" size={20} color="#3b82f6" style={{ marginLeft: 12 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Số điện thoại"
                    placeholderTextColor="#cbd5e1"
                    value={form.phone}
                    onChangeText={t => setForm(f => ({ ...f, phone: t }))}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditMode(false)}>
                <Ionicons name="close" size={20} color="#ef4444" />
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* View Mode */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="person" size={24} color="#3b82f6" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Tên hiển thị</Text>
                  <Text style={styles.infoValue}>{profile.displayName || 'Chưa thiết lập'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="call" size={24} color="#10b981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValue}>{profile.phone || 'Chưa thiết lập'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="mail" size={24} color="#f59e0b" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email / Username</Text>
                  <Text style={styles.infoValue}>{profile.username}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
              <Ionicons name="create" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Chỉnh sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Dang xuat</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 16,
  },
  userHandle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  errorText: {
    flex: 1,
    textAlign: 'center',
    marginTop: 40,
    color: '#64748b',
    fontSize: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '700',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    color: '#1e293b',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    elevation: 3,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 16,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 32,
    elevation: 3,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
