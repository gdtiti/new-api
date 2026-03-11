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

import { Button, Card, Progress, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight, IconRefresh } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { renderQuota, renderQuotaWithAmount } from '../../helpers';
import RechargeCard from '../topup/RechargeCard';
import usePortalBillingData from '../../hooks/portal/usePortalBillingData';
import PortalBillingOverlays from './PortalBillingOverlays';
import PortalStateBlock from './PortalStateBlock';

const PortalWalletPage = () => {
  const navigate = useNavigate();
  const billing = usePortalBillingData();
  const user = billing.userState?.user;
  const activePlanCount = billing.subscriptionCardProps?.plans?.length || 0;

  if (billing.initializing && !user) {
    return (
      <PortalStateBlock
        type='loading'
        title={billing.t('正在加载钱包与额度')}
        description={billing.t('正在准备余额、支付方式和最近账单。')}
      />
    );
  }

  const walletMetricCards = [
    {
      key: 'quota',
      label: billing.t('钱包余额'),
      value: renderQuota(user?.quota || 0),
      hint: billing.t('当前可用余额'),
    },
    {
      key: 'used',
      label: billing.t('历史消耗'),
      value: renderQuota(user?.used_quota || 0),
      hint: billing.t('累计历史请求消耗'),
    },
    {
      key: 'minimum',
      label: billing.t('最低充值'),
      value: renderQuotaWithAmount(billing.minTopUp || 0),
      hint: billing.t('按当前系统配置执行'),
    },
    {
      key: 'plans',
      label: billing.t('可购套餐'),
      value: `${activePlanCount}`,
      hint: billing.t('可在订阅中心查看详情'),
    },
  ];

  return (
    <div className='portal-overview portal-billing'>
      <Card
        className='portal-panel portal-overview__hero portal-billing__hero'
        bordered={false}
      >
        <div className='portal-overview__hero-content'>
          <div>
            <div className='portal-overview__eyebrow'>
              {billing.t('钱包与额度')}
            </div>
            <h1 className='portal-overview__hero-title'>
              {billing.t('集中查看余额、充值能力与计费来源')}
            </h1>
            <p className='portal-overview__hero-description'>
              {billing.t(
                '这里整合了钱包充值、支付方式、最近账单和订阅扣费说明，帮助你在同一页面完成充值判断与支付确认。',
              )}
            </p>
          </div>
          <div className='portal-overview__hero-actions'>
            <Button
              theme='solid'
              type='primary'
              icon={<IconRefresh />}
              loading={billing.refreshing}
              onClick={billing.refreshAll}
            >
              {billing.t('刷新数据')}
            </Button>
            <Button
              theme='light'
              type='tertiary'
              icon={<IconArrowRight />}
              onClick={() => navigate('/app/subscription')}
            >
              {billing.t('查看订阅中心')}
            </Button>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconArrowRight />}
              onClick={() => navigate('/app/logs')}
            >
              {billing.t('查看使用日志')}
            </Button>
          </div>
        </div>
        <div className='portal-overview__hero-side'>
          <div className='portal-overview__hero-kpi'>
            <span>{billing.t('当前扣费偏好')}</span>
            <strong>{billing.billingPreferenceLabel}</strong>
            <small>{billing.billingSourceSummary}</small>
          </div>
          <div className='portal-overview__hero-kpi'>
            <span>{billing.t('生效订阅')}</span>
            <strong>{billing.activeSubscriptionCount}</strong>
            <small>
              {billing.hasActiveSubscription
                ? billing.t('主套餐剩余 {{quota}}', {
                    quota: renderQuota(billing.primarySubscriptionRemain),
                  })
                : billing.t('当前暂无生效订阅')}
            </small>
          </div>
        </div>
      </Card>

      <div className='portal-overview__metrics'>
        {walletMetricCards.map((item) => (
          <Card
            key={item.key}
            className='portal-panel portal-overview__metric'
            bordered={false}
          >
            <span className='portal-overview__metric-label'>{item.label}</span>
            <strong className='portal-overview__metric-value'>
              {item.value}
            </strong>
            <small className='portal-overview__metric-hint'>{item.hint}</small>
          </Card>
        ))}
      </div>

      <div className='portal-billing__summary-grid'>
        <Card className='portal-panel portal-billing__summary' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>
                {billing.t('扣费来源')}
              </div>
              <h2>{billing.billingPreferenceLabel}</h2>
            </div>
            <Tag color='violet' shape='circle'>
              {billing.hasActiveSubscription
                ? billing.t('订阅可用')
                : billing.t('钱包兜底')}
            </Tag>
          </div>
          <p className='portal-billing__description'>
            {billing.billingSourceSummary}
          </p>
          <div className='portal-billing__summary-metrics'>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('当前主套餐')}</span>
              <strong>{billing.primarySubscriptionTitle}</strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('剩余额度')}</span>
              <strong>{renderQuota(billing.primarySubscriptionRemain)}</strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('剩余天数')}</span>
              <strong>
                {billing.primarySubscriptionRemainDays === null
                  ? billing.t('未设置')
                  : billing.t('{{days}} 天', {
                      days: billing.primarySubscriptionRemainDays,
                    })}
              </strong>
            </div>
          </div>
          <Progress
            percent={billing.primarySubscriptionUsagePercent}
            stroke='#7c3aed'
            showInfo
            format={(percent) => `${percent}%`}
          />
        </Card>

        <Card
          className='portal-panel portal-detail-panel portal-billing__methods'
          bordered={false}
        >
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>
                {billing.t('支付方式')}
              </div>
              <h2>{billing.t('当前可用的充值路径')}</h2>
            </div>
          </div>
          {billing.paymentMethodSummary.length ? (
            <div className='portal-billing__method-list'>
              {billing.paymentMethodSummary.map((method) => (
                <div className='portal-billing__method' key={method.type}>
                  <div>
                    <strong>{method.displayName}</strong>
                    <p>{method.minimumText}</p>
                  </div>
                  <span
                    className='portal-billing__method-dot'
                    style={{ background: method.color }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <PortalStateBlock
              compact
              contained={false}
              title={billing.t('暂无可用支付方式')}
              description={billing.t(
                '当前尚未开启在线充值，请联系管理员确认支付方式配置。',
              )}
            />
          )}
        </Card>
      </div>

      <div className='portal-billing__content-grid'>
        <div className='portal-billing__main'>
          <RechargeCard
            {...billing.rechargeCardProps}
            subscriptionLoading={false}
            subscriptionPlans={[]}
          />
        </div>

        <div className='portal-billing__side'>
          <Card
            className='portal-panel portal-detail-panel portal-billing__side-card'
            bordered={false}
          >
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>
                  {billing.t('最近账单')}
                </div>
                <h2>{billing.t('钱包与订阅的最近变化')}</h2>
              </div>
              <Button
                theme='borderless'
                type='tertiary'
                icon={<IconArrowRight />}
                onClick={billing.handleOpenHistory}
              >
                {billing.t('查看完整账单')}
              </Button>
            </div>
            {billing.recentBillingItems.length ? (
              <div className='portal-billing__record-list'>
                {billing.recentBillingItems.map((item) => (
                  <div className='portal-billing__record' key={item.key}>
                    <div>
                      <strong>{item.sourceLabel}</strong>
                      <p>
                        {item.paymentMethodLabel} · {item.createdAt}
                      </p>
                    </div>
                    <div className='portal-billing__record-meta'>
                      <span>{item.moneyLabel}</span>
                      <Tag
                        color={
                          item.sourceTone === 'subscription'
                            ? 'violet'
                            : 'green'
                        }
                        shape='circle'
                      >
                        {item.amountLabel}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PortalStateBlock
                compact
                contained={false}
                title={billing.t('暂无最近账单')}
                description={billing.t(
                  '完成充值或购买套餐后，这里会展示最近的账单摘要。',
                )}
              />
            )}
          </Card>

          <Card
            className='portal-panel portal-detail-panel portal-billing__side-card'
            bordered={false}
          >
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>
                  {billing.t('订阅摘要')}
                </div>
                <h2>{billing.primarySubscriptionTitle}</h2>
              </div>
              <Button
                theme='borderless'
                type='tertiary'
                icon={<IconArrowRight />}
                onClick={() => navigate('/app/subscription')}
              >
                {billing.t('前往订阅中心')}
              </Button>
            </div>
            <div className='portal-billing__summary-metrics'>
              <div className='portal-billing__summary-item'>
                <span>{billing.t('生效套餐')}</span>
                <strong>{billing.activeSubscriptionCount}</strong>
              </div>
              <div className='portal-billing__summary-item'>
                <span>{billing.t('过期记录')}</span>
                <strong>{billing.expiredSubscriptionCount}</strong>
              </div>
            </div>
            <p className='portal-billing__description'>
              {billing.billingSourceSummary}
            </p>
          </Card>
        </div>
      </div>

      <PortalBillingOverlays billing={billing} />
    </div>
  );
};

export default PortalWalletPage;
