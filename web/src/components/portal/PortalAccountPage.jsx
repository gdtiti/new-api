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

import { Button, Card } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BellRing, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PersonalSetting from '../settings/PersonalSetting';

const PortalAccountPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const accountHighlights = [
    {
      key: 'profile',
      icon: <UserRound size={18} />,
      title: t('资料与令牌联动管理'),
      description: t('账户资料、系统令牌、密码与绑定信息统一从门户进入。'),
    },
    {
      key: 'security',
      icon: <ShieldCheck size={18} />,
      title: t('安全设置集中可见'),
      description: t('Passkey、邮箱绑定和账号删除等动作不再散落在旧界面里。'),
    },
    {
      key: 'notification',
      icon: <BellRing size={18} />,
      title: t('偏好与通知归档'),
      description: t(
        '提醒方式、展示偏好和个性化设置继续保留，并接入新的门户容器。',
      ),
    },
  ];

  return (
    <div className='portal-page portal-account'>
      <Card className='portal-panel portal-section-hero' bordered={false}>
        <div className='portal-section-hero__main'>
          <div className='portal-section-hero__eyebrow'>{t('账户与安全')}</div>
          <h1 className='portal-section-hero__title'>
            {t('把账户资料、安全和偏好设置统一收进门户')}
          </h1>
          <p className='portal-section-hero__description'>
            {t(
              '账户页保留现有资料、安全和通知能力，但不再沿用旧控制台的视觉壳层，让个人设置也纳入同一套门户风格。',
            )}
          </p>
          <div className='portal-section-hero__actions'>
            <Button
              theme='solid'
              type='primary'
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/app/tokens')}
            >
              {t('返回令牌中心')}
            </Button>
            <Button
              theme='light'
              type='primary'
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/app/logs')}
            >
              {t('查看日志中心')}
            </Button>
          </div>
        </div>

        <div className='portal-section-hero__aside'>
          <div className='portal-section-hero__badge'>{t('统一承载')}</div>
          <strong className='portal-section-hero__aside-title'>
            {t('账户页也保持新的门户质感与排版节奏')}
          </strong>
          <p className='portal-section-hero__aside-description'>
            {t(
              '后续再扩展个人资料模块时，可以继续沿用这套门户容器和主题变量。',
            )}
          </p>
        </div>
      </Card>

      <div className='portal-page-highlights portal-page-highlights--compact'>
        {accountHighlights.map((item) => (
          <Card
            key={item.key}
            className='portal-panel portal-highlight-card'
            bordered={false}
          >
            <span className='portal-highlight-card__icon'>{item.icon}</span>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </Card>
        ))}
      </div>

      <section className='portal-embedded-workspace portal-embedded-workspace--account'>
        <PersonalSetting />
      </section>
    </div>
  );
};

export default PortalAccountPage;
