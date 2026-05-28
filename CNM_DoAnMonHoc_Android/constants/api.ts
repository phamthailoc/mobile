import Constants from 'expo-constants';
import { Platform } from 'react-native';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const detectedApiUrl = `http://${expoHost || fallbackHost}:3001`;

export const API_BASE_URL = (envApiUrl || detectedApiUrl).replace(/\/$/, '');
