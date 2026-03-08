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

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Tag, Typography } from '@douyinfe/semi-ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  CreditCard,
  FileText,
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

const { Text, Title } = Typography;

const PORTAL_SIDEBAR_COLLAPSED_KEY = 'portal_sidebar_collapsed';

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const systemName = getSystemName();
  const logo = getLogo();
  const user = userState?.user;
  const status = statusState?.status || {};
  const isAdmin = user && typeof user.role === 'number' && user.role >= 10;

  useEffect(() => {
    localStorage.setItem(
      PORTAL_SIDEBAR_COLLAPSED_KEY,
      sidebarCollapsed ? 'true' : 'false',
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navSections = useMemo(
    () => [
      {
        label: t('经营概览'),
        items: [
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

  const goTo = useCallback(
    (to) => {
      navigate(to);
    },
    [navigate],
  );

  const handleLogout = useCallback(async () => {
    await API.get('/api/user/logout');
    showSuccess(t('注销成功!'));
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate, t, userDispatch]);

  return (
    <div className='portal-shell'>
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
                <Text strong>{user?.display_name || user?.username || 'User'}</Text>
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
          <div>
            <Text className='portal-shell__eyebrow'>{t('第一阶段')}</Text>
            <Title heading={4} className='!mb-1'>
              {t('客户门户骨架已接入')}
            </Title>
            <Text type='secondary'>
              {t(
                '当前阶段先完成独立门户路由、导航分层与统一认证回跳，后续阶段再逐页深化数据视图。',
              )}
            </Text>
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
        </section>

        <main className='portal-shell__content'>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PortalShell;
