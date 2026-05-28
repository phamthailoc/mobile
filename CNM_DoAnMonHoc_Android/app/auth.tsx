import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { getApiErrorMessage } from '@/services/http';
import { saveSession } from '@/services/session-storage';

function normalizeSession(payload: any) {
  const session = payload?.user || payload?.data || payload || {};
  return {
    ...session,
    token: session.token || session.accessToken || session.jwt || session.authToken || payload?.token || payload?.accessToken || payload?.jwt || payload?.authToken || '',
    sessionId: session.sessionId || session.session_id || payload?.sessionId || payload?.session_id || '',
    username: session.username || payload?.username || payload?.user?.username || '',
    displayName: session.displayName || payload?.displayName || payload?.user?.displayName || '',
    role: session.role || payload?.role || payload?.user?.role || '',
    avatar: session.avatar ?? payload?.avatar ?? payload?.user?.avatar ?? null,
  };
}

export default function AuthScreen({ setUser }: any) {
  const [view, setView] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    username: '', password: '', email: '', displayName: '', otp: '', newPassword: ''
  });

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (view === 'login') {
        const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          username: form.username, password: form.password
        });
        const session = normalizeSession(res.data);
        await saveSession(session);
        setUser(session); // Lưu user session vào state cha
        alert('Đăng nhập thành công!');
      } else if (view === 'register') {
        await axios.post(`${API_BASE_URL}/api/auth/register`, form);
        setView('verify');
      } else if (view === 'verify') {
        await axios.post(`${API_BASE_URL}/api/auth/verify`, {
          username: form.username, otp: form.otp
        });
        setView('login');
      } else if (view === 'forgot') {
        await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: form.email });
        setView('reset');
      } else if (view === 'reset') {
        await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
          email: form.email, otp: form.otp, newPassword: form.newPassword
        });
        setView('login');
      }
    } catch (err: any) {
      alert(getApiErrorMessage(err, 'Loi he thong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {view === 'login' ? 'Đăng nhập' : view === 'register' ? 'Đăng ký' : 'Xác thực'}
        </Text>
        {view === 'login' && (
          <>
            <TextInput style={styles.input} placeholder="Tên đăng nhập" value={form.username} onChangeText={t => setForm(f => ({ ...f, username: t }))} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Mật khẩu" value={form.password} onChangeText={t => setForm(f => ({ ...f, password: t }))} secureTextEntry />
          </>
        )}
        {view === 'register' && (
          <>
            <TextInput style={styles.input} placeholder="Tên đăng nhập" value={form.username} onChangeText={t => setForm(f => ({ ...f, username: t }))} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Email" value={form.email} onChangeText={t => setForm(f => ({ ...f, email: t }))} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Tên hiển thị" value={form.displayName} onChangeText={t => setForm(f => ({ ...f, displayName: t }))} />
            <TextInput style={styles.input} placeholder="Mật khẩu" value={form.password} onChangeText={t => setForm(f => ({ ...f, password: t }))} secureTextEntry />
          </>
        )}
        {(view === 'verify' || view === 'forgot' || view === 'reset') && (
          <>
            <TextInput style={styles.input} placeholder="OTP" value={form.otp} onChangeText={t => setForm(f => ({ ...f, otp: t }))} keyboardType="numeric" />
            {view === 'reset' && (
              <TextInput style={styles.input} placeholder="Mật khẩu mới" value={form.newPassword} onChangeText={t => setForm(f => ({ ...f, newPassword: t }))} secureTextEntry />
            )}
          </>
        )}
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tiếp tục</Text>}
        </TouchableOpacity>
        <View style={styles.switchRow}>
          {view === 'login' ? (
            <>
              <TouchableOpacity onPress={() => setView('register')}><Text style={styles.link}>Đăng ký</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setView('forgot')}><Text style={styles.link}>Quên mật khẩu?</Text></TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setView('login')}><Text style={styles.link}>Quay lại đăng nhập</Text></TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  card: { width: '90%', maxWidth: 400, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { color: '#60a5fa', fontWeight: 'bold', fontSize: 14, marginHorizontal: 8 },
});
