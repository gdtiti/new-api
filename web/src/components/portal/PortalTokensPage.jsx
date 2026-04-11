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
import { ArrowRight, KeyRound, ShieldCheck, Workflow, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TokensPage from '../table/tokens';

const PortalTokensPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const tokenHighlights = [
    {
      key: 'visibility',
      icon: <KeyRound size={18} />,
      title: t('主模块回归显眼位置'),
      description: t(
        '令牌中心现在位于门户一级导航，进入 `/app` 后可以直接管理。',
      ),
    },
    {
      key: 'security',
      icon: <ShieldCheck size={18} />,
      title: t('密钥查看与编辑集中处理'),
      description: t('保留现有编辑、批量复制、状态切换和密钥显隐能力。'),
    },
    {
      key: 'workflow',
      icon: <Workflow size={18} />,
      title: t('联动模型与日志排查'),
      description: t(
        '生成或检查令牌后，可以继续跳去模型广场和日志中心分析使用情况。',
      ),
    },
    {
      key: 'integration',
      icon: <Zap size={18} />,
      title: t('兼容既有接入流程'),
      description: t(
        'Cherry Studio、FluentRead、CCSwitch 等现有辅助动作仍可直接使用。',
      ),
    },
  ];

  return (
    <div className='portal-page portal-tokens'>
      <Card className='portal-panel portal-section-hero' bordered={false}>
        <div className='portal-section-hero__main'>
          <div className='portal-section-hero__eyebrow'>{t('令牌中心')}</div>
          <h1 className='portal-section-hero__title'>
            {t('把令牌管理放回客户门户的核心位置')}
          </h1>
          <p className='portal-section-hero__description'>
            {t(
              '这里统一承接令牌创建、状态切换、批量操作、密钥查看和外部工具接入，不再要求回到旧控制台路径寻找入口。',
            )}
          </p>
          <div className='portal-section-hero__actions'>
            <Button
              theme='solid'
              type='primary'
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/app/logs')}
            >
              {t('查看调用日志')}
            </Button>
            <Button
              theme='light'
              type='primary'
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/app/models')}
            >
              {t('查看模型广场')}
            </Button>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<ArrowRight size={16} />}
              onClick={() => navigate('/app/account')}
            >
              {t('前往账户与安全')}
            </Button>
          </div>
        </div>

        <div className='portal-section-hero__aside'>
          <div className='portal-section-hero__badge'>{t('主模块')}</div>
          <strong className='portal-section-hero__aside-title'>
            {t('令牌、模型、日志三条链路已经打通')}
          </strong>
          <p className='portal-section-hero__aside-description'>
            {t(
              '你可以先管理令牌，再继续分析调用模型和用量明细，整个路径保持在同一套门户风格里。',
            )}
          </p>
        </div>
      </Card>

      <div className='portal-page-highlights'>
        {tokenHighlights.map((item) => (
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

      <section className='portal-embedded-workspace portal-embedded-workspace--tokens'>
        <TokensPage />
      </section>
    </div>
  );
};

export default PortalTokensPage;
