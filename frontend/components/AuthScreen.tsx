/**
 * Auth Screen — 登录 / 注册页面
 * 
 * 参考 HackTravel 原型图设计：
 * - 登录：邮箱密码 / 手机验证码 / 社交登录
 * - 注册：姓名、邮箱/手机、密码、同意条款
 * - 支持 Google / Facebook / Instagram 一键登录
 * - 手机号支持国际区号选择
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/services/auth';
import { sendEmailCode, sendSmsCode } from '@/services/api';
import { Toast } from '@/components/Toast';
import { Avatar } from '@/components/Avatar';

// 常用国家区号
const COUNTRY_CODES = [
  { code: '+86', name: '中国', flag: '🇨🇳' },
  { code: '+1', name: '美国/加拿大', flag: '🇺🇸' },
  { code: '+852', name: '香港', flag: '🇭🇰' },
  { code: '+853', name: '澳门', flag: '🇲🇴' },
  { code: '+886', name: '台湾', flag: '🇹🇼' },
  { code: '+81', name: '日本', flag: '🇯🇵' },
  { code: '+82', name: '韩国', flag: '🇰🇷' },
  { code: '+65', name: '新加坡', flag: '🇸🇬' },
  { code: '+60', name: '马来西亚', flag: '🇲🇾' },
  { code: '+66', name: '泰国', flag: '🇹🇭' },
  { code: '+84', name: '越南', flag: '🇻🇳' },
  { code: '+62', name: '印度尼西亚', flag: '🇮🇩' },
  { code: '+63', name: '菲律宾', flag: '🇵🇭' },
  { code: '+44', name: '英国', flag: '🇬🇧' },
  { code: '+49', name: '德国', flag: '🇩🇪' },
  { code: '+33', name: '法国', flag: '🇫🇷' },
  { code: '+61', name: '澳大利亚', flag: '🇦🇺' },
];

type AuthMode = 'login' | 'register';
type LoginMethod = 'email' | 'phone';

const ENABLE_SMS_LOGIN = false;
const SOCIAL_LOGIN_CONFIGURED = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  || process.env.EXPO_PUBLIC_FACEBOOK_APP_ID
  || process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID,
);
const ENABLE_SOCIAL_LOGIN = process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN === 'true' && SOCIAL_LOGIN_CONFIGURED;
const SOCIAL_LOGIN_DISABLED_REASON = SOCIAL_LOGIN_CONFIGURED
  ? '社交登录未开启'
  : '社交登录未配置';

interface AuthScreenProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onSuccess?: () => void;
}

export function AuthScreen({ visible, onClose, initialMode = 'login', onSuccess }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, signIn, signInSocial } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 登录表单
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [emailLoginMode, setEmailLoginMode] = useState<'password' | 'code'>('password');

  // 手机登录
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+86');
  const [smsCode, setSmsCode] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 注册表单
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const isValidEmail = (value: string) => {
    const candidate = value.trim().toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate);
  };

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  const isValidPhone = (value: string) => {
    const digits = normalizePhone(value);
    return digits.length >= 5 && digits.length <= 15;
  };

  const handleSendEmailCode = useCallback(async () => {
    if (!isValidEmail(email)) {
      showToast('邮箱格式不正确');
      return;
    }

    setIsLoading(true);
    try {
      await sendEmailCode(email);
      setEmailCountdown(60);
      showToast('验证码已发送');

      const timer = setInterval(() => {
        setEmailCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      showToast(err.message || '发送失败');
    } finally {
      setIsLoading(false);
    }
  }, [email, isValidEmail]);

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!ENABLE_SMS_LOGIN) {
      showToast('短信验证码暂未开放');
      return;
    }
    if (!isValidPhone(phone)) {
      showToast('请输入有效的手机号');
      return;
    }

    setIsLoading(true);
    try {
      await sendSmsCode({ phone, country_code: countryCode });
      setCodeSent(true);
      setCountdown(60);
      showToast('验证码已发送');

      // 倒计时
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      showToast(err.message || '发送失败');
    } finally {
      setIsLoading(false);
    }
  }, [phone, countryCode]);

  // 邮箱登录
  const handleEmailLogin = useCallback(async () => {
    if (!email || !password) {
      showToast('请输入邮箱和密码');
      return;
    }
    if (!isValidEmail(email)) {
      showToast('邮箱格式不正确');
      return;
    }
    if (password.length < 6) {
      showToast('密码至少 6 位');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn({ email, password });
      if (result.success) {
        showToast('登录成功');
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || '登录失败');
      }
    } catch (err: any) {
      showToast(err.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, signIn, onSuccess, onClose]);

  const handleEmailCodeLogin = useCallback(async () => {
    if (!email || !emailCode) {
      showToast('请输入邮箱和验证码');
      return;
    }
    if (!isValidEmail(email)) {
      showToast('邮箱格式不正确');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn({ email, email_code: emailCode });
      if (result.success) {
        showToast('登录成功');
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || '登录失败');
      }
    } catch (err: any) {
      showToast(err.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  }, [email, emailCode, isValidEmail, signIn, onSuccess, onClose]);

  // 手机验证码登录
  const handlePhoneLogin = useCallback(async () => {
    if (!ENABLE_SMS_LOGIN) {
      showToast('短信验证码暂未开放');
      return;
    }
    if (!phone || !smsCode) {
      showToast('请输入手机号和验证码');
      return;
    }
    if (!isValidPhone(phone)) {
      showToast('手机号格式不正确');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn({ phone, country_code: countryCode, sms_code: smsCode });
      if (result.success) {
        showToast('登录成功');
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || '登录失败');
      }
    } catch (err: any) {
      showToast(err.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  }, [phone, countryCode, smsCode, signIn, onSuccess, onClose]);

  // 注册
  const handleRegister = useCallback(async () => {
    if (!name) {
      showToast('请输入姓名');
      return;
    }

    if (loginMethod === 'email') {
      if (!email) {
        showToast('请输入邮箱');
        return;
      }
      if (!isValidEmail(email)) {
        showToast('邮箱格式不正确');
        return;
      }
      if (password && password !== confirmPassword) {
        showToast('两次密码不一致');
        return;
      }
      if (password && password.length < 6) {
        showToast('密码至少 6 位');
        return;
      }
      if (!password && !emailCode) {
        showToast('请输入邮箱验证码');
        return;
      }
    } else {
      if (!phone || !smsCode) {
        showToast('请输入手机号和验证码');
        return;
      }
      if (!isValidPhone(phone)) {
        showToast('手机号格式不正确');
        return;
      }
    }

    if (!agreeTerms) {
      showToast('请同意服务条款和隐私政策');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp({
        name,
        email: loginMethod === 'email' ? email : undefined,
        email_code: loginMethod === 'email' ? (emailCode || undefined) : undefined,
        phone: loginMethod === 'phone' ? phone : undefined,
        country_code: loginMethod === 'phone' ? countryCode : undefined,
        password: password || undefined,
      });

      if (result.success) {
        showToast(result.message || '注册成功');
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || '注册失败');
      }
    } catch (err: any) {
      showToast(err.message || '注册失败');
    } finally {
      setIsLoading(false);
    }
  }, [name, email, phone, countryCode, password, confirmPassword, smsCode, loginMethod, agreeTerms, signUp, onSuccess, onClose]);

  // 社交登录
  const handleSocialLogin = useCallback(async (provider: 'google' | 'facebook' | 'instagram') => {
    if (!ENABLE_SOCIAL_LOGIN) {
      showToast(SOCIAL_LOGIN_DISABLED_REASON);
      return;
    }
    setIsLoading(true);
    try {
      // 实际集成需要使用 expo-auth-session 或对应 SDK
      // 这里模拟社交登录流程
      const result = await signInSocial({
        provider,
        token: `mock_${provider}_token_${Date.now()}`,
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      });

      if (result.success) {
        showToast(result.message || '登录成功');
        onSuccess?.();
        onClose();
      } else {
        showToast(result.message || '登录失败');
      }
    } catch (err: any) {
      showToast(err.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  }, [signInSocial, onSuccess, onClose]);

  // 切换模式
  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.brandTitle}>Hack Travel</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="airplane" size={32} color="#FFFFFF" />
            </View>
            {mode === 'login' && (
              <Text style={styles.tagline}>Explore the world with ease</Text>
            )}
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === 'login' ? 'Welcome Back' : 'Join the Adventure'}
            </Text>
            {mode === 'register' && (
              <Text style={styles.cardSubtitle}>Start your next journey with us</Text>
            )}

            {/* 注册时显示姓名输入 */}
            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={Colors.textLight}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* 登录方式切换 - 仅登录模式 */}
            {mode === 'login' && ENABLE_SMS_LOGIN && (
              <View style={styles.methodTabs}>
                <TouchableOpacity
                  style={[styles.methodTab, loginMethod === 'email' && styles.methodTabActive]}
                  onPress={() => setLoginMethod('email')}
                >
                  <Text style={[styles.methodTabText, loginMethod === 'email' && styles.methodTabTextActive]}>
                    邮箱
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.methodTab, loginMethod === 'phone' && styles.methodTabActive]}
                  onPress={() => setLoginMethod('phone')}
                >
                  <Text style={[styles.methodTabText, loginMethod === 'phone' && styles.methodTabTextActive]}>
                    手机号
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 邮箱登录/注册 */}
            {(mode === 'register' || loginMethod === 'email') && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={mode === 'login' ? 'name@example.com' : 'email@example.com'}
                      placeholderTextColor={Colors.textLight}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    {mode === 'login' && (
                      <TouchableOpacity>
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {mode === 'login' && emailLoginMode === 'code' ? (
                    <View style={styles.inputContainer}>
                      <Ionicons name="key-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter verification code"
                        placeholderTextColor={Colors.textLight}
                        value={emailCode}
                        onChangeText={setEmailCode}
                        keyboardType="number-pad"
                      />
                    </View>
                  ) : (
                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (optional)'}
                        placeholderTextColor={Colors.textLight}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons
                          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color={Colors.textLight}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                  {mode === 'login' && (
                    <TouchableOpacity onPress={() => {
                      setEmailLoginMode(prev => prev === 'password' ? 'code' : 'password');
                      setEmailCode('');
                    }}>
                      <Text style={styles.forgotText}>
                        {emailLoginMode === 'password' ? 'Use verification code' : 'Use password'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 注册时显示确认密码 */}
                {mode === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirm Password</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm your password"
                        placeholderTextColor={Colors.textLight}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                      />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                        <Ionicons
                          name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color={Colors.textLight}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {(mode === 'register' || emailLoginMode === 'code') && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Code</Text>
                    <View style={styles.codeInputRow}>
                      <View style={[styles.inputContainer, styles.codeInput]}>
                        <Ionicons name="key-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Enter code"
                          placeholderTextColor={Colors.textLight}
                          value={emailCode}
                          onChangeText={setEmailCode}
                          keyboardType="number-pad"
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.sendCodeBtn, emailCountdown > 0 && styles.sendCodeBtnDisabled]}
                        onPress={handleSendEmailCode}
                        disabled={isLoading || emailCountdown > 0}
                      >
                        <Text style={styles.sendCodeText}>
                          {emailCountdown > 0 ? `${emailCountdown}s` : 'Send Code'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* 手机号登录 */}
            {mode === 'login' && ENABLE_SMS_LOGIN && loginMethod === 'phone' && (
              <>
                {!ENABLE_SMS_LOGIN && (
                  <Text style={styles.helperText}>短信验证码暂未开放</Text>
                )}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>手机号码</Text>
                  <View style={styles.phoneInputRow}>
                    <TouchableOpacity
                      style={styles.countryCodeBtn}
                      onPress={() => setShowCountryPicker(true)}
                    >
                      <Text style={styles.countryCodeText}>{countryCode}</Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={[styles.inputContainer, styles.phoneInput]}>
                      <TextInput
                        style={styles.input}
                        placeholder="请输入手机号"
                        placeholderTextColor={Colors.textLight}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>验证码</Text>
                  <View style={styles.codeInputRow}>
                    <View style={[styles.inputContainer, styles.codeInput]}>
                      <TextInput
                        style={styles.input}
                        placeholder="请输入验证码"
                        placeholderTextColor={Colors.textLight}
                        value={smsCode}
                        onChangeText={setSmsCode}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.sendCodeBtn, countdown > 0 && styles.sendCodeBtnDisabled]}
                      onPress={handleSendCode}
                      disabled={countdown > 0 || isLoading}
                    >
                      <Text style={styles.sendCodeText}>
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* 注册时的服务条款 */}
            {mode === 'register' && (
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgreeTerms(!agreeTerms)}
              >
                <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                  {agreeTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>.
                </Text>
              </TouchableOpacity>
            )}

            {/* 主按钮 */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (mode === 'login') {
                  if (loginMethod === 'email') {
                    emailLoginMode === 'code' ? handleEmailCodeLogin() : handleEmailLogin();
                  } else if (ENABLE_SMS_LOGIN) {
                    handlePhoneLogin();
                  } else {
                    showToast('手机号登录暂未开放');
                  }
                } else {
                  handleRegister();
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {mode === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                  {mode === 'register' && (
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  )}
                </>
              )}
            </TouchableOpacity>

            {/* 分隔线 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 社交登录 */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialBtn, !ENABLE_SOCIAL_LOGIN && styles.socialBtnDisabled]}
                onPress={() => handleSocialLogin('google')}
                disabled={isLoading || !ENABLE_SOCIAL_LOGIN}
              >
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialBtn, !ENABLE_SOCIAL_LOGIN && styles.socialBtnDisabled]}
                onPress={() => handleSocialLogin('facebook')}
                disabled={isLoading || !ENABLE_SOCIAL_LOGIN}
              >
                <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                <Text style={styles.socialText}>Facebook</Text>
              </TouchableOpacity>
            </View>
            {!ENABLE_SOCIAL_LOGIN && (
              <Text style={styles.helperText}>{SOCIAL_LOGIN_DISABLED_REASON}</Text>
            )}
          </View>

          {/* 切换登录/注册 */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <TouchableOpacity onPress={toggleMode}>
              <Text style={styles.switchLink}>
                {mode === 'login' ? 'Create an Account' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Featured Destination (仅登录页显示) */}
          {mode === 'login' && (
            <View style={styles.featuredCard}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600' }}
                style={styles.featuredImage}
              />
              <View style={styles.featuredOverlay}>
                <Text style={styles.featuredLabel}>FEATURED DESTINATION</Text>
                <Text style={styles.featuredTitle}>Olympic National Forest</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 国家区号选择器 */}
        <Modal visible={showCountryPicker} transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContainer, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>选择国家/地区</Text>
                <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {COUNTRY_CODES.map((country) => (
                  <TouchableOpacity
                    key={country.code}
                    style={[
                      styles.pickerItem,
                      countryCode === country.code && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setCountryCode(country.code);
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerFlag}>{country.flag}</Text>
                    <Text style={styles.pickerName}>{country.name}</Text>
                    <Text style={styles.pickerCode}>{country.code}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {toastMessage ? <Toast message={toastMessage} onDismiss={() => setToastMessage('')} /> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    left: Spacing.lg,
    padding: Spacing.xs,
  },
  brandTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  cardTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  cardSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  methodTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  methodTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  methodTabActive: {
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  methodTabText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  methodTabTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  helperText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  countryCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  countryCodeText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  phoneInput: {
    flex: 1,
  },
  codeInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  codeInput: {
    flex: 1,
  },
  sendCodeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCodeBtnDisabled: {
    backgroundColor: Colors.textLight,
  },
  sendCodeText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: '#4285F4',
  },
  socialText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  socialBtnDisabled: {
    opacity: 0.5,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  switchText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  featuredCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    height: 160,
    ...Shadow.md,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  featuredLabel: {
    fontSize: FontSize.xxs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  featuredTitle: {
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  // Picker styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  pickerList: {
    padding: Spacing.md,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  pickerItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  pickerFlag: {
    fontSize: 24,
  },
  pickerName: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  pickerCode: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
});

export default AuthScreen;
