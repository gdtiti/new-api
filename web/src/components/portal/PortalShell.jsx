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

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Avatar, Button, Tag, Typography } from '@douyinfe/semi-ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, getLogo, getSystemName, showSuccess } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import PortalThemePicker from './PortalThemePicker';
import {
  DEFAULT_PORTAL_SKIN,
  getPortalSkin,
  PORTAL_SKIN_STORAGE_KEY,
  PORTAL_SIDEBAR_COLLAPSED_KEY,
} from './portalSkin';

const { Text, Title } = Typography;

const PortalShell = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(PORTAL_SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [skinKey, setSkinKey] = useState(
    () => localStorage.getItem(PORTAL_SKIN_STORAGE_KEY) || DEFAULT_PORTAL_SKIN,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const systemName = getSystemName();
  const logo = getLogo();
  const user = userState?.user;
  const status = statusState?.status || {};
  const isAdmin = user && typeof user.role === 'number' && user.role >= 10;
  const activeSkin = useMemo(() => getPortalSkin(skinKey), [skinKey]);

  useEffect(() => {
    localStorage.setItem(
      PORTAL_SIDEBAR_COLLAPSED_KEY,
      sidebarCollapsed ? 'true' : 'false',
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(PORTAL_SKIN_STORAGE_KEY, activeSkin.key);
  }, [activeSkin.key]);

  const navSections = useMemo(
    () => [
      {
        label: t('核心入口'),
        items: [
          {
            key: 'tokens',
            title: t('令牌中心'),
            description: t('直接进入令牌管理、批量操作与密钥查看'),
            to: '/app/tokens',
            icon: KeyRound,
          },
          {
            key: 'overview',
            title: t('总览'),
            description: t('查看账户、消耗、余额与快捷操作'),
            to: '/app/overview',
            icon: LayoutDashboard,
          },
          {
            key: 'analytics',
            title: t('数据分析'),
            description: t('跟踪趋势、请求量与近期使用分布'),
            to: '/app/analytics',
            icon: BarChart3,
          },
        ],
      },
      {
        label: t('账单与记录'),
        items: [
          {
            key: 'wallet',
            title: t('钱包与额度'),
            description: t('查看余额、充值方式与额度使用'),
            to: '/app/wallet',
            icon: Wallet,
          },
          {
            key: 'subscription',
            title: t('我的订阅'),
            description: t('查看套餐状态、偏好与续费入口'),
            to: '/app/subscription',
            icon: CreditCard,
          },
          {
            key: 'logs',
            title: t('使用日志'),
            description: t('检索调用记录、状态与扣费来源'),
            to: '/app/logs',
            icon: FileText,
          },
        ],
      },
      {
        label: t('能力中心'),
        items: [
          {
            key: 'models',
            title: t('模型广场'),
            description: t('浏览模型、价格、可用性与能力标签'),
            to: '/app/models',
            icon: Boxes,
          },
          {
            key: 'account',
            title: t('账户与安全'),
            description: t('管理资料、认证方式与安全设置'),
            to: '/app/account',
            icon: UserRound,
          },
        ],
      },
    ],
    [t],
  );

  const navItems = useMemo(
    () => navSections.flatMap((section) => section.items),
    [navSections],
  );

  const currentItem = useMemo(() => {
    return (
      navItems.find((item) => {
        return (
          location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`)
        );
      }) || navItems[0]
    );
  }, [location.pathname, navItems]);

  const statusTags = useMemo(() => {
    const tags = [];

    if (status.passkey_login) {
      tags.push({
        color: 'blue',
        text: t('Passkey 已启用'),
      });
    }

    if (status.github_oauth || status.discord_oauth || status.oidc_enabled) {
      tags.push({
        color: 'green',
        text: t('第三方登录可用'),
      });
    }

    if (status.enable_online_topup) {
      tags.push({
        color: 'violet',
        text: t('在线充值已开启'),
      });
    }

    return tags;
  }, [
    status.discord_oauth,
    status.enable_online_topup,
    status.github_oauth,
    status.oidc_enabled,
    status.passkey_login,
    t,
  ]);

  const heroStats = useMemo(
    () => [
      {
        key: 'module',
        label: t('当前模块'),
        value: currentItem?.title || t('总览'),
        hint: currentItem?.description || t('统一查看客户侧经营与账户信息'),
      },
      {
        key: 'coverage',
        label: t('覆盖能力'),
        value: `${navItems.length}`,
        hint: t('令牌、总览、账单、日志、模型与账户能力已纳入统一门户'),
      },
      {
        key: 'status',
        label: t('接入状态'),
        value: statusTags.length ? t('多能力已启用') : t('基础能力可用'),
        hint: statusTags.length
          ? t('认证、支付与第三方入口会按系统配置动态展示')
          : t('登录与基础客户能力已就绪，可继续按模块深入使用'),
      },
    ],
    [
      currentItem?.description,
      currentItem?.title,
      navItems.length,
      statusTags.length,
      t,
    ],
  );

  const goTo = useCallback(
    (to) => {
      navigate(to);
    },
    [navigate],
  );

  const topLevelActions = useMemo(
    () => [
      {
        key: 'tokens',
        label: t('令牌中心'),
        onClick: () => goTo('/app/tokens'),
        type: 'primary',
        theme: 'solid',
        icon: <KeyRound size={16} />,
      },
      {
        key: 'models',
        label: t('模型广场'),
        onClick: () => goTo('/app/models'),
        type: 'primary',
        theme: 'light',
        icon: <Boxes size={16} />,
      },
      {
        key: 'account',
        label: t('账户与安全'),
        onClick: () => goTo('/app/account'),
        type: 'tertiary',
        theme: 'borderless',
        icon: <UserRound size={16} />,
      },
    ],
    [goTo, t],
  );

  const handleLogout = useCallback(async () => {
    await API.get('/api/user/logout');
    showSuccess(t('注销成功!'));
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate, t, userDispatch]);

  return (
    <div
      className='portal-shell'
      data-portal-mode={activeSkin.mode}
      data-portal-skin={activeSkin.key}
    >
      <div className='blur-ball blur-ball-indigo portal-shell__blur portal-shell__blur--primary' />
      <div className='blur-ball blur-ball-teal portal-shell__blur portal-shell__blur--secondary' />

      {isMobile && mobileNavOpen && (
        <button
          aria-label={t('关闭导航')}
          className='portal-shell__overlay'
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={[
          'portal-shell__sidebar',
          sidebarCollapsed ? 'portal-shell__sidebar--collapsed' : '',
          mobileNavOpen ? 'portal-shell__sidebar--open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          className='portal-shell__brand'
          onClick={() => goTo('/app/overview')}
          type='button'
        >
          {logo ? (
            <img
              src={logo}
              alt={systemName}
              className='portal-shell__brand-logo'
            />
          ) : (
            <div className='portal-shell__brand-logo portal-shell__brand-logo--fallback'>
              {systemName.slice(0, 1).toUpperCase()}
            </div>
          )}

          {!sidebarCollapsed && (
            <div className='portal-shell__brand-copy'>
              <Text className='portal-shell__eyebrow'>{t('客户门户')}</Text>
              <Title heading={5} className='!mb-0'>
                {systemName}
              </Title>
            </div>
          )}
        </button>

        <div className='portal-shell__nav'>
          {!sidebarCollapsed && (
            <div className='portal-shell__nav-featured'>
              <div className='portal-shell__nav-featured-header'>
                <div className='portal-shell__nav-featured-copy'>
                  <span className='portal-shell__nav-featured-badge'>
                    {t('主模块')}
                  </span>
                  <strong>{t('令牌中心已前置到门户一级导航')}</strong>
                </div>
                <KeyRound size={18} />
              </div>
              <p>
                {t(
                  '生成、查看、复制和批量管理令牌，现在都可以直接从这里进入，不再隐藏在旧控制台页面里。',
                )}
              </p>
              <Button
                icon={<ArrowUpRight size={16} />}
                onClick={() => goTo('/app/tokens')}
                theme='solid'
                type='primary'
              >
                {t('打开令牌中心')}
              </Button>
            </div>
          )}

          {navSections.map((section) => (
            <div className='portal-shell__nav-section' key={section.label}>
              {!sidebarCollapsed && (
                <Text className='portal-shell__nav-section-label'>
                  {section.label}
                </Text>
              )}

              <div className='portal-shell__nav-items'>
                {section.items.map((item) => {
                  const IconComponent = item.icon;
                  const isActive =
                    location.pathname === item.to ||
                    location.pathname.startsWith(`${item.to}/`);

                  return (
                    <button
                      className={[
                        'portal-shell__nav-item',
                        isActive ? 'portal-shell__nav-item--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={item.key}
                      onClick={() => goTo(item.to)}
                      type='button'
                    >
                      <span className='portal-shell__nav-icon'>
                        <IconComponent size={18} />
                      </span>
                      {!sidebarCollapsed && (
                        <span className='portal-shell__nav-copy'>
                          <span className='portal-shell__nav-title'>
                            {item.title}
                          </span>
                          <span className='portal-shell__nav-description'>
                            {item.description}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className='portal-shell__sidebar-footer'>
          {!isMobile && (
            <Button
              block
              icon={
                sidebarCollapsed ? (
                  <PanelLeftOpen size={16} />
                ) : (
                  <PanelLeftClose size={16} />
                )
              }
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              theme='outline'
              type='tertiary'
            >
              {sidebarCollapsed ? null : t('折叠导航')}
            </Button>
          )}
        </div>
      </aside>

      <div className='portal-shell__main'>
        <header className='portal-shell__header'>
          <div className='portal-shell__header-main'>
            {isMobile && (
              <button
                aria-label={t('打开导航')}
                className='portal-shell__icon-button'
                onClick={() => setMobileNavOpen(true)}
                type='button'
              >
                <Menu size={18} />
              </button>
            )}

            <div className='portal-shell__title-group'>
              <Text className='portal-shell__eyebrow'>{t('客户工作台')}</Text>
              <Title heading={3} className='!mb-0'>
                {currentItem?.title || t('总览')}
              </Title>
              <Text type='secondary'>
                {currentItem?.description || t('统一查看客户侧经营与账户信息')}
              </Text>
            </div>
          </div>

          <div className='portal-shell__header-actions'>
            <PortalThemePicker
              onSelect={setSkinKey}
              selectedSkinKey={activeSkin.key}
              t={t}
            />

            <Button
              icon={<KeyRound size={16} />}
              onClick={() => goTo('/app/tokens')}
              theme='solid'
              type='primary'
            >
              {t('令牌中心')}
            </Button>

            {isAdmin && (
              <Button
                icon={<ShieldCheck size={16} />}
                onClick={() => goTo('/console')}
                theme='outline'
                type='tertiary'
              >
                {t('管理后台')}
              </Button>
            )}

            <Button
              icon={<ArrowUpRight size={16} />}
              onClick={() => goTo('/pricing')}
              theme='outline'
              type='tertiary'
            >
              {t('模型价格')}
            </Button>

            <div className='portal-shell__user-chip'>
              <Avatar size='small' color='light-blue'>
                {(user?.username || user?.display_name || 'U')
                  .slice(0, 1)
                  .toUpperCase()}
              </Avatar>
              <div className='portal-shell__user-copy'>
                <Text strong>
                  {user?.display_name || user?.username || 'User'}
                </Text>
                <Text type='secondary' size='small'>
                  {isAdmin ? t('管理员账户') : t('客户账户')}
                </Text>
              </div>
            </div>

            <Button
              icon={<LogOut size={16} />}
              onClick={handleLogout}
              theme='borderless'
              type='tertiary'
            >
              {!isMobile ? t('退出') : null}
            </Button>
          </div>
        </header>

        <section className='portal-shell__hero'>
          <div className='portal-shell__hero-main'>
            <div className='portal-shell__hero-copy'>
              <Text className='portal-shell__eyebrow'>{t('统一客户门户')}</Text>
              <Title heading={4} className='!mb-1'>
                {t('在 {{module}} 中保持一致的客户体验', {
                  module: currentItem?.title || t('总览'),
                })}
              </Title>
              <Text type='secondary'>
                {t(
                  '围绕令牌、余额、订阅、日志与模型分析重组信息架构，把原来分散的入口收回到同一套门户视觉和操作路径里。',
                )}
              </Text>
            </div>

            <div className='portal-shell__hero-actions'>
              {topLevelActions.map((action) => (
                <Button
                  key={action.key}
                  icon={action.icon}
                  onClick={action.onClick}
                  theme={action.theme}
                  type={action.type}
                >
                  {action.label}
                </Button>
              ))}
            </div>

            <div className='portal-shell__hero-grid'>
              {heroStats.map((item) => (
                <div className='portal-shell__hero-stat' key={item.key}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.hint}</small>
                </div>
              ))}
            </div>
          </div>

          <div className='portal-shell__hero-rail'>
            <div className='portal-shell__hero-spotlight'>
              <div className='portal-shell__hero-spotlight-header'>
                <span className='portal-shell__hero-spotlight-badge'>
                  {t('本轮重点')}
                </span>
                <KeyRound size={18} />
              </div>
              <strong>{t('令牌管理已经提升为门户主入口')}</strong>
              <p>
                {t(
                  '新的导航、头部动作和总览快捷入口都会直接引导到令牌中心，模型广场和日志中心也围绕令牌路径继续联动。',
                )}
              </p>
              <Button
                icon={<ArrowUpRight size={16} />}
                onClick={() => goTo('/app/tokens')}
                theme='light'
                type='primary'
              >
                {t('查看令牌工作区')}
              </Button>
            </div>

            <div className='portal-shell__tags'>
              {statusTags.length > 0 ? (
                statusTags.map((tag) => (
                  <Tag color={tag.color} key={tag.text} shape='circle'>
                    {tag.text}
                  </Tag>
                ))
              ) : (
                <Tag color='grey' shape='circle'>
                  {t('基础认证已可用')}
                </Tag>
              )}
            </div>
          </div>
        </section>

        <main className='portal-shell__content'>
          <Outlet
            context={{ portalSkinKey: activeSkin.key, portalSkin: activeSkin }}
          />
        </main>
      </div>
    </div>
  );
};

export default PortalShell;
