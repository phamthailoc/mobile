import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';

type BotMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export default function ChatbotPopup({ visible, onClose }: any) {
  const [messages, setMessages] = useState<BotMessage[]>([
    { role: 'assistant', content: 'Xin chào! Tôi là Trợ lý Cộng đồng. Bạn cần hỗ trợ gì?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: BotMessage = { role: 'user', content: input };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/chatbot`, { messages: nextMessages });
      setMessages(msgs => [...msgs, { role: 'assistant', content: res.data.reply || '...' }]);
    } catch {
      setMessages(msgs => [...msgs, { role: 'assistant', content: 'Lỗi kết nối chatbot!' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <Text style={styles.header}>Chatbot</Text>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <View style={[styles.msg, item.role === 'user' ? styles.userMsg : styles.botMsg]}>
                <Text>{item.content}</Text>
              </View>
            )}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Nhập câu hỏi..."
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Gửi</Text>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose}><Text style={styles.close}>Đóng</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  popup: { width: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 16, alignItems: 'stretch' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  msg: { padding: 8, borderRadius: 10, marginVertical: 4 },
  userMsg: { backgroundColor: '#e0e7ff', alignSelf: 'flex-end' },
  botMsg: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 10, fontSize: 16, marginRight: 8 },
  sendBtn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 12 },
  close: { color: '#6366f1', fontWeight: 'bold', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
