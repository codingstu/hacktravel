/**
 * Auth Context — 用户认证状态管理
 * 
 * 功能：
 * - 存储当前登录用户信息
 * - 持久化 token 到 AsyncStorage
 * - 提供登录/注册/退出方法
 * - 检查 AI 使用限制
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  register, login, socialLogin, logout, getMe, getAIUsage, setAuthToken, getAuthToken,
} from '@/services/api';
import type {
  AuthUser, RegisterRequest, LoginRequest, SocialLoginRequest,
} from '@/services/types';

const AUTH_TOKEN_KEY = 'hkt_auth_token';
const AUTH_USER_KEY = 'hkt_auth_user';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
}

interface AuthContextValue extends AuthState {
  // 认证方法
  signUp: (data: RegisterRequest) => Promise<{ success: boolean; message?: string }>;
  signIn: (data: LoginRequest) => Promise<{ success: boolean; message?: string }>;
  signInSocial: (data: SocialLoginRequest) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  // AI 使用限制（内部自动获取 deviceId）
  checkAILimit: () => Promise<boolean>;
  incrementAIUsage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：从 AsyncStorage 恢复登录状态
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);

        if (storedToken && storedUser) {
          setAuthToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // 验证 token 是否有效
          try {
            const res = await getMe();
            setUser(res.user);
          } catch {
            // Token 已过期，清除
            await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
            setAuthToken(null);
            setToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('[Auth] restore failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, []);

  // 注册
  const signUp = useCallback(async (data: RegisterRequest) => {
    try {
      const res = await register(data);
      if (res.success) {
        setAuthToken(res.token);
        setToken(res.token);
        setUser(res.user);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        return { success: true, message: res.message };
      }
      return { success: false, message: '注册失败' };
    } catch (err: any) {
      return { success: false, message: err.message || '注册失败' };
    }
  }, []);

  // 登录
  const signIn = useCallback(async (data: LoginRequest) => {
    try {
      const res = await login(data);
      if (res.success) {
        setAuthToken(res.token);
        setToken(res.token);
        setUser(res.user);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, message: '登录失败' };
    } catch (err: any) {
      return { success: false, message: err.message || '登录失败' };
    }
  }, []);

  // 社交登录
  const signInSocial = useCallback(async (data: SocialLoginRequest) => {
    try {
      const res = await socialLogin(data);
      if (res.success) {
        setAuthToken(res.token);
        setToken(res.token);
        setUser(res.user);
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        return { success: true, message: res.is_new ? '欢迎加入 HackTravel！' : undefined };
      }
      return { success: false, message: '登录失败' };
    } catch (err: any) {
      return { success: false, message: err.message || '登录失败' };
    }
  }, []);

  // 退出
  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch {
      // 即使 API 失败也清除本地状态
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
  }, []);

  // 检查 AI 使用限制（未登录用户免费 3 次）
  const checkAILimit = useCallback(async (): Promise<boolean> => {
    // 已登录用户不受限制
    if (user) return true;

    try {
      // 获取 device_id
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      const res = await getAIUsage(deviceId);
      return res.can_use;
    } catch {
      // 网络失败时放行
      return true;
    }
  }, [user]);

  // 增加 AI 使用次数
  const incrementAIUsage = useCallback(async (): Promise<void> => {
    // 已登录用户不需要计数
    if (user) return;

    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      // 调用后端记录使用次数
      await getAIUsage(deviceId);
    } catch {
      // 忽略错误
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isLoggedIn: !!user && !!token,
    signUp,
    signIn,
    signInSocial,
    signOut,
    checkAILimit,
    incrementAIUsage,
  }), [user, token, isLoading, signUp, signIn, signInSocial, signOut, checkAILimit, incrementAIUsage]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
