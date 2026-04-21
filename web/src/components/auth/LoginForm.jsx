/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  resolvePostLoginTarget,
  updateAPI,
  getSystemName,
  getOAuthProviderIcon,
  setUserData,
  onGitHubOAuthClicked,
  onDiscordOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onCustomOAuthClicked,
  prepareCredentialRequestOptions,
  buildAssertionResult,
  isPasskeySupported,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Icon,
  Modal,
} from '@douyinfe/semi-ui';
import Title from '@douyinfe/semi-ui/lib/es/typography/title';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import TelegramLoginButton from 'react-telegram-login';

import {
  IconGithubLogo,
  IconMail,
  IconLock,
  IconKey,
} from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const LoginForm = () => {
  let navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const githubButtonTextKeyByState = {
    idle: '使用 GitHub 继续',
    redirecting: '正在跳转 GitHub...',
    timeout: '请求超时，请刷新页面后重新发起 GitHub 登录',
  };
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    wechat_verification_code: '',
  });
  const { username, password } = inputs;
  const [searchParams] = useSearchParams();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [otherLoginOptionsLoading, setOtherLoginOptionsLoading] =
    useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});

  const logo = getLogo();
  const systemName = getSystemName();

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) {
    localStorage.setItem('aff', affCode);
  }

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try {
      return JSON.parse(savedStatus) || {};
    } catch (err) {
      return {};
    }
  }, [statusState?.status]);
  const hasCustomOAuthProviders =
    (status.custom_oauth_providers || []).length > 0;
  const hasOAuthLoginOptions = Boolean(
    status.github_oauth ||
      status.discord_oauth ||
      status.oidc_enabled ||
      status.wechat_login ||
      status.linuxdo_oauth ||
      status.telegram_oauth ||
      hasCustomOAuthProviders,
  );
  const availableLoginMethods = useMemo(() => {
    const methods = [];

    if (status.wechat_login) methods.push(t('微信'));
    if (status.github_oauth) methods.push('GitHub');
    if (status.discord_oauth) methods.push('Discord');
    if (status.oidc_enabled) methods.push('OIDC');
    if (status.linuxdo_oauth) methods.push('LinuxDO');
    if (status.telegram_oauth) methods.push('Telegram');
    if (hasCustomOAuthProviders) {
      status.custom_oauth_providers.forEach((provider) => {
        methods.push(provider.name);
      });
    }
    if (status.passkey_login && passkeySupported) methods.push('Passkey');
    methods.push(t('邮箱 / 用户名'));

    return methods;
  }, [
    hasCustomOAuthProviders,
    passkeySupported,
    status.custom_oauth_providers,
    status.discord_oauth,
    status.github_oauth,
    status.linuxdo_oauth,
    status.oidc_enabled,
    status.passkey_login,
    status.telegram_oauth,
    status.wechat_login,
    t,
  ]);
  const disabledMethodHints = useMemo(() => {
    const hints = [];

    if (!hasOAuthLoginOptions) {
      hints.push(t('当前仅开放邮箱密码登录'));
    }

    if (status.passkey_login && !passkeySupported) {
      hints.push(t('当前设备暂不支持 Passkey，可改用密码或第三方登录'));
    }

    if (!status.passkey_login) {
      hints.push(t('Passkey 尚未启用'));
    }

    return hints;
  }, [hasOAuthLoginOptions, passkeySupported, status.passkey_login, t]);
  const navigateAfterLogin = (data, fallbackTarget) => {
    navigate(resolvePostLoginTarget(data, location.state, fallbackTarget));
  };

  useEffect(() => {
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }

    // 从 status 获取用户协议和隐私政策的启用状态
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    isPasskeySupported()
      .then(setPasskeySupported)
      .catch(() => setPasskeySupported(false));

    return () => {
      if (githubTimeoutRef.current) {
        clearTimeout(githubTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) {
      showError(t('未登录或登录已过期，请重新登录'));
    }
  }, []);

  const onWeChatLoginClicked = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setWechatLoading(true);
    setShowWeChatLoginModal(true);
    setWechatLoading(false);
  };

  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setWechatCodeSubmitLoading(true);
    try {
      const res = await API.get(
        `/api/oauth/wechat?code=${inputs.wechat_verification_code}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        setUserData(data);
        updateAPI();
        navigateAfterLogin(data);
        showSuccess('登录成功！');
        setShowWeChatLoginModal(false);
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setWechatCodeSubmitLoading(false);
    }
  };

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (turnstileEnabled && turnstileToken === '') {
      showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！');
      return;
    }
    setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(
          `/api/user/login?turnstile=${turnstileToken}`,
          {
            username,
            password,
          },
        );
        const { success, message, data } = res.data;
        if (success) {
          // 检查是否需要2FA验证
          if (data && data.require_2fa) {
            setShowTwoFA(true);
            setLoginLoading(false);
            return;
          }

          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI();
          showSuccess('登录成功！');
          if (username === 'root' && password === '123456') {
            Modal.error({
              title: '您正在使用默认密码！',
              content: '请立刻修改默认密码！',
              centered: true,
            });
          }
          navigateAfterLogin(data);
        } else {
          showError(message);
        }
      } else {
        showError('请输入用户名和密码！');
      }
    } catch (error) {
      showError('登录失败，请重试');
    } finally {
      setLoginLoading(false);
    }
  }

  // 添加Telegram登录处理函数
  const onTelegramLoginClicked = async (response) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    const fields = [
      'id',
      'first_name',
      'last_name',
      'username',
      'photo_url',
      'auth_date',
      'hash',
      'lang',
    ];
    const params = {};
    fields.forEach((field) => {
      if (response[field]) {
        params[field] = response[field];
      }
    });
    try {
      const res = await API.get(`/api/oauth/telegram/login`, { params });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        showSuccess('登录成功！');
        setUserData(data);
        updateAPI();
        navigateAfterLogin(data);
      } else {
        showError(message);
      }
    } catch (error) {
      showError('登录失败，请重试');
    }
  };

  // 包装的GitHub登录点击处理
  const handleGitHubClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (githubButtonDisabled) {
      return;
    }
    setGithubLoading(true);
    setGithubButtonDisabled(true);
    setGithubButtonState('redirecting');
    if (githubTimeoutRef.current) {
      clearTimeout(githubTimeoutRef.current);
    }
    githubTimeoutRef.current = setTimeout(() => {
      setGithubLoading(false);
      setGithubButtonState('timeout');
      setGithubButtonDisabled(true);
    }, 20000);
    try {
      onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setGithubLoading(false), 3000);
    }
  };

  // 包装的Discord登录点击处理
  const handleDiscordClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setDiscordLoading(true);
    try {
      onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setDiscordLoading(false), 3000);
    }
  };

  // 包装的OIDC登录点击处理
  const handleOIDCClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setOidcLoading(true);
    try {
      onOIDCClicked(
        status.oidc_authorization_endpoint,
        status.oidc_client_id,
        false,
        { shouldLogout: true },
      );
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setOidcLoading(false), 3000);
    }
  };

  // 包装的LinuxDO登录点击处理
  const handleLinuxDOClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setLinuxdoLoading(true);
    try {
      onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => setLinuxdoLoading(false), 3000);
    }
  };

  // 包装的自定义OAuth登录点击处理
  const handleCustomOAuthClick = (provider) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: true }));
    try {
      onCustomOAuthClicked(provider, { shouldLogout: true });
    } finally {
      // 由于重定向，这里不会执行到，但为了完整性添加
      setTimeout(() => {
        setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: false }));
      }, 3000);
    }
  };

  // 包装的邮箱登录选项点击处理
  const handleEmailLoginClick = () => {
    setEmailLoginLoading(true);
    setShowEmailLogin(true);
    setEmailLoginLoading(false);
  };

  const handlePasskeyLogin = async () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    if (!passkeySupported) {
      showInfo('当前环境无法使用 Passkey 登录');
      return;
    }
    if (!window.PublicKeyCredential) {
      showInfo('当前浏览器不支持 Passkey');
      return;
    }

    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/login/begin');
      const { success, message, data } = beginRes.data;
      if (!success) {
        showError(message || '无法发起 Passkey 登录');
        return;
      }

      const publicKeyOptions = prepareCredentialRequestOptions(
        data?.options || data?.publicKey || data,
      );
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      });
      const payload = buildAssertionResult(assertion);
      if (!payload) {
        showError('Passkey 验证失败，请重试');
        return;
      }

      const finishRes = await API.post(
        '/api/user/passkey/login/finish',
        payload,
      );
      const finish = finishRes.data;
      if (finish.success) {
        userDispatch({ type: 'login', payload: finish.data });
        setUserData(finish.data);
        updateAPI();
        showSuccess('登录成功！');
        navigateAfterLogin(finish.data);
      } else {
        showError(finish.message || 'Passkey 登录失败，请重试');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        showInfo('已取消 Passkey 登录');
      } else {
        showError('Passkey 登录失败，请重试');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  // 包装的重置密码点击处理
  const handleResetPasswordClick = () => {
    setResetPasswordLoading(true);
    navigate('/reset');
    setResetPasswordLoading(false);
  };

  // 包装的其他登录选项点击处理
  const handleOtherLoginOptionsClick = () => {
    setOtherLoginOptionsLoading(true);
    setShowEmailLogin(false);
    setOtherLoginOptionsLoading(false);
  };

  // 2FA验证成功处理
  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess('登录成功！');
    navigateAfterLogin(data);
  };

  // 返回登录页面
  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({ username: '', password: '', wechat_verification_code: '' });
  };

  const renderAgreementConsent = () => {
    if (!hasUserAgreement && !hasPrivacyPolicy) {
      return null;
    }

    return (
      <div className='auth-hub__agreement'>
        <Checkbox
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
        >
          <Text size='small' className='auth-hub__agreement-text'>
            {t('我已阅读并同意')}
            {hasUserAgreement && (
              <a
                href='/user-agreement'
                target='_blank'
                rel='noopener noreferrer'
                className='auth-hub__agreement-link'
              >
                {t('用户协议')}
              </a>
            )}
            {hasUserAgreement && hasPrivacyPolicy && t('和')}
            {hasPrivacyPolicy && (
              <a
                href='/privacy-policy'
                target='_blank'
                rel='noopener noreferrer'
                className='auth-hub__agreement-link'
              >
                {t('隐私政策')}
              </a>
            )}
          </Text>
        </Checkbox>
      </div>
    );
  };

  const renderRegisterHint = () => {
    if (status.self_use_mode_enabled) {
      return null;
    }

    return (
      <div className='auth-hub__register-hint'>
        <Text>
          {t('没有账户？')}{' '}
          <Link to='/register' className='auth-hub__agreement-link'>
            {t('注册')}
          </Link>
        </Text>
      </div>
    );
  };

  const renderHubTabs = () => {
    return (
      <div className='auth-hub__tabs'>
        <button
          className={[
            'auth-hub__tab',
            !showEmailLogin ? 'auth-hub__tab--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setShowEmailLogin(false)}
          type='button'
        >
          {t('统一认证入口')}
        </button>
        <button
          className={[
            'auth-hub__tab',
            showEmailLogin ? 'auth-hub__tab--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setShowEmailLogin(true)}
          type='button'
        >
          {t('邮箱 / 用户名登录')}
        </button>
      </div>
    );
  };

  const renderOverviewPanel = () => {
    return (
      <div className='auth-hub__overview'>
        <div className='auth-hub__brand-row'>
          <img src={logo} alt='Logo' className='auth-hub__brand-logo' />
          <div>
            <Text className='auth-hub__eyebrow'>{t('全新客户门户 v1')}</Text>
            <Title heading={2} className='!mb-0'>
              {systemName}
            </Title>
          </div>
        </div>

        <div className='auth-hub__headline-block'>
          <Title heading={2} className='!mb-2'>
            {t('统一登录后，直接进入您的客户工作台')}
          </Title>
          <Text type='secondary'>
            {t(
              '把登录、账户安全、总览分析、钱包订阅和日志入口整合为一套更简洁、更正规、更易理解的客户体验。',
            )}
          </Text>
        </div>

        <div className='auth-hub__feature-list'>
          <div className='auth-hub__feature-item'>
            <Text strong>{t('多方式认证')}</Text>
            <Text type='secondary'>
              {t('支持邮箱密码、OAuth、Passkey 与 2FA 二段验证。')}
            </Text>
          </div>
          <div className='auth-hub__feature-item'>
            <Text strong>{t('登录后精准回跳')}</Text>
            <Text type='secondary'>
              {t('客户默认进入 `/app/overview`，管理员保留 `/console` 入口。')}
            </Text>
          </div>
          <div className='auth-hub__feature-item'>
            <Text strong>{t('面向客户的统一门户')}</Text>
            <Text type='secondary'>
              {t('第一阶段先完成门户壳层与认证中心，后续逐页深化数据视图。')}
            </Text>
          </div>
        </div>
      </div>
    );
  };

  const renderAvailabilityPanel = () => {
    return (
      <Card className='auth-hub__side-card auth-hub__availability-card'>
        <div className='auth-hub__side-card-header'>
          <Text className='auth-hub__eyebrow'>{t('认证状态')}</Text>
          <Title heading={5} className='!mb-0'>
            {t('当前可用登录方式')}
          </Title>
        </div>

        <div className='auth-hub__chip-list'>
          {availableLoginMethods.map((method) => (
            <span className='auth-hub__chip' key={method}>
              {method}
            </span>
          ))}
        </div>

        {disabledMethodHints.length > 0 && (
          <div className='auth-hub__hint-list'>
            {disabledMethodHints.map((hint) => (
              <div className='auth-hub__hint-item' key={hint}>
                <span className='auth-hub__hint-dot' />
                <Text type='secondary'>{hint}</Text>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const renderTwoFASection = () => {
    return (
      <Card className='auth-hub__card auth-hub__card--wide'>
        <div className='auth-hub__card-header'>
          <Text className='auth-hub__eyebrow'>{t('二段验证')}</Text>
          <Title heading={4} className='!mb-1'>
            {t('继续完成安全验证')}
          </Title>
          <Text type='secondary'>
            {t('账号已通过首段认证，请完成 2FA 后进入对应工作区。')}
          </Text>
        </div>

        <TwoFAVerification
          onSuccess={handle2FASuccess}
          onBack={handleBackToLogin}
          isModal={true}
        />
      </Card>
    );
  };

  const renderOAuthOptions = () => {
    return (
      <Card className='auth-hub__card'>
        <div className='auth-hub__card-header'>
          <Text className='auth-hub__eyebrow'>{t('统一认证入口')}</Text>
          <Title heading={4} className='!mb-1'>
            {t('选择适合您的登录方式')}
          </Title>
          <Text type='secondary'>
            {t('优先展示当前系统已开放的认证方式，并为禁用能力给出清晰提示。')}
          </Text>
        </div>

        <div className='auth-hub__action-list'>
          {status.wechat_login && (
            <Button
              block
              theme='outline'
              className='auth-hub__action-button'
              type='tertiary'
              icon={<Icon svg={<WeChatIcon />} style={{ color: '#07C160' }} />}
              onClick={onWeChatLoginClicked}
              loading={wechatLoading}
            >
              {t('使用 微信 继续')}
            </Button>
          )}

          {status.github_oauth && (
            <Button
              block
              theme='outline'
              className='auth-hub__action-button'
              type='tertiary'
              icon={<IconGithubLogo size='large' />}
              onClick={handleGitHubClick}
              loading={githubLoading}
              disabled={githubButtonDisabled}
            >
              {githubButtonText}
            </Button>
          )}

          {status.discord_oauth && (
            <Button
              block
              theme='outline'
              className='auth-hub__action-button'
              type='tertiary'
              icon={
                <SiDiscord
                  style={{ color: '#5865F2', width: '20px', height: '20px' }}
                />
              }
              onClick={handleDiscordClick}
              loading={discordLoading}
            >
              {t('使用 Discord 继续')}
            </Button>
          )}

          {status.oidc_enabled && (
            <Button
              block
              theme='outline'
              className='auth-hub__action-button'
              type='tertiary'
              icon={<OIDCIcon style={{ color: '#1877F2' }} />}
              onClick={handleOIDCClick}
              loading={oidcLoading}
            >
              {t('使用 OIDC 继续')}
            </Button>
          )}

          {status.linuxdo_oauth && (
            <Button
              block
              theme='outline'
              className='auth-hub__action-button'
              type='tertiary'
              icon={
                <LinuxDoIcon
                  style={{ color: '#E95420', width: '20px', height: '20px' }}
                />
              }
              onClick={handleLinuxDOClick}
              loading={linuxdoLoading}
            >
              {t('使用 LinuxDO 继续')}
            </Button>
          )}

          {status.custom_oauth_providers &&
            status.custom_oauth_providers.map((provider) => (
              <Button
                block
                key={provider.slug}
                theme='outline'
                className='auth-hub__action-button'
                type='tertiary'
                icon={getOAuthProviderIcon(provider.icon || '', 20)}
                onClick={() => handleCustomOAuthClick(provider)}
                loading={customOAuthLoading[provider.slug]}
              >
                {t('使用 {{name}} 继续', { name: provider.name })}
              </Button>
            ))}

          {status.telegram_oauth && (
            <div className='auth-hub__telegram'>
              <TelegramLoginButton
                dataOnauth={onTelegramLoginClicked}
                botName={status.telegram_bot_name}
              />
            </div>
          )}

          {status.passkey_login && passkeySupported && (
            <Button
              block
              theme='outline'
              className='auth-hub__action-button'
              type='tertiary'
              icon={<IconKey size='large' />}
              onClick={handlePasskeyLogin}
              loading={passkeyLoading}
            >
              {t('使用 Passkey 登录')}
            </Button>
          )}
        </div>

        <Divider margin='12px' align='center'>
          {t('或')}
        </Divider>

        <Button
          block
          theme='solid'
          type='primary'
          className='auth-hub__primary-button'
          icon={<IconMail size='large' />}
          onClick={handleEmailLoginClick}
          loading={emailLoginLoading}
        >
          {t('使用 邮箱或用户名 登录')}
        </Button>

        {renderAgreementConsent()}
        {renderRegisterHint()}
      </Card>
    );
  };

  const renderEmailLoginForm = () => {
    return (
      <Card className='auth-hub__card'>
        <div className='auth-hub__card-header'>
          <Text className='auth-hub__eyebrow'>{t('邮箱 / 用户名')}</Text>
          <Title heading={4} className='!mb-1'>
            {t('使用账号密码登录')}
          </Title>
          <Text type='secondary'>
            {t('完成登录后将按角色与来源自动回跳到客户门户或管理后台。')}
          </Text>
        </div>

        {status.passkey_login && passkeySupported && (
          <Button
            block
            theme='outline'
            type='tertiary'
            className='auth-hub__action-button auth-hub__action-button--spaced'
            icon={<IconKey size='large' />}
            onClick={handlePasskeyLogin}
            loading={passkeyLoading}
          >
            {t('使用 Passkey 登录')}
          </Button>
        )}

        <Form className='auth-hub__form'>
          <Form.Input
            field='username'
            label={t('用户名或邮箱')}
            placeholder={t('请输入您的用户名或邮箱地址')}
            name='username'
            onChange={(value) => handleChange('username', value)}
            prefix={<IconMail />}
          />

          <Form.Input
            field='password'
            label={t('密码')}
            placeholder={t('请输入您的密码')}
            name='password'
            mode='password'
            onChange={(value) => handleChange('password', value)}
            prefix={<IconLock />}
          />

          {renderAgreementConsent()}

          <div className='auth-hub__form-actions'>
            <Button
              block
              theme='solid'
              className='auth-hub__primary-button'
              type='primary'
              htmlType='submit'
              onClick={handleSubmit}
              loading={loginLoading}
              disabled={(hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms}
            >
              {t('继续')}
            </Button>

            <Button
              block
              theme='borderless'
              type='tertiary'
              className='auth-hub__secondary-button'
              onClick={handleResetPasswordClick}
              loading={resetPasswordLoading}
            >
              {t('忘记密码？')}
            </Button>
          </div>
        </Form>

        {hasOAuthLoginOptions && (
          <>
            <Divider margin='12px' align='center'>
              {t('或')}
            </Divider>

            <Button
              block
              theme='outline'
              type='tertiary'
              className='auth-hub__secondary-button'
              onClick={handleOtherLoginOptionsClick}
              loading={otherLoginOptionsLoading}
            >
              {t('切换到其他登录方式')}
            </Button>
          </>
        )}

        {renderRegisterHint()}
      </Card>
    );
  };

  // 微信登录模态框
  const renderWeChatLoginModal = () => {
    return (
      <Modal
        title={t('微信扫码登录')}
        visible={showWeChatLoginModal}
        maskClosable={true}
        onOk={onSubmitWeChatVerificationCode}
        onCancel={() => setShowWeChatLoginModal(false)}
        okText={t('登录')}
        centered={true}
        okButtonProps={{
          loading: wechatCodeSubmitLoading,
        }}
      >
        <div className='flex flex-col items-center'>
          <img src={status.wechat_qrcode} alt='微信二维码' className='mb-4' />
        </div>

        <div className='text-center mb-4'>
          <p>
            {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
          </p>
        </div>

        <Form>
          <Form.Input
            field='wechat_verification_code'
            placeholder={t('验证码')}
            label={t('验证码')}
            value={inputs.wechat_verification_code}
            onChange={(value) =>
              handleChange('wechat_verification_code', value)
            }
          />
        </Form>
      </Modal>
    );
  };

  return (
    <div className='auth-hub-shell'>
      <div
        className='blur-ball blur-ball-indigo'
        style={{ top: '-80px', right: '-80px', transform: 'none' }}
      />
      <div
        className='blur-ball blur-ball-teal'
        style={{ top: '50%', left: '-120px' }}
      />

      <div className='auth-hub-shell__inner'>
        <section className='auth-hub-shell__overview'>
          {renderOverviewPanel()}
        </section>

        <section className='auth-hub-shell__main'>
          {!showTwoFA && hasOAuthLoginOptions && renderHubTabs()}

          <div className='auth-hub-shell__grid'>
            <div className='auth-hub-shell__primary'>
              {showTwoFA ? (
                renderTwoFASection()
              ) : showEmailLogin || !hasOAuthLoginOptions ? (
                renderEmailLoginForm()
              ) : (
                renderOAuthOptions()
              )}
            </div>

            {!showTwoFA && (
              <div className='auth-hub-shell__secondary'>
                {renderAvailabilityPanel()}
              </div>
            )}
          </div>

          {turnstileEnabled && (
            <div className='auth-hub__turnstile'>
              <Turnstile
                sitekey={turnstileSiteKey}
                onVerify={(token) => {
                  setTurnstileToken(token);
                }}
              />
            </div>
          )}
        </section>
      </div>

      {renderWeChatLoginModal()}
    </div>
  );
};

export default LoginForm;
