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
import { renderQuota } from '../../helpers';
import SubscriptionPlansCard from '../topup/SubscriptionPlansCard';
import usePortalBillingData from '../../hooks/portal/usePortalBillingData';
import PortalBillingOverlays from './PortalBillingOverlays';
import PortalStateBlock from './PortalStateBlock';

const PortalSubscriptionPage = () => {
  const navigate = useNavigate();
  const billing = usePortalBillingData();

  if (billing.initializing && !billing.userState?.user) {
    return (
      <PortalStateBlock
        type='loading'
        title={billing.t('正在加载订阅中心')}
        description={billing.t('正在准备套餐、扣费偏好和订阅账单。')}
      />
    );
  }

  const subscriptionMetricCards = [
    {
      key: 'active',
      label: billing.t('生效订阅'),
      value: `${billing.activeSubscriptionCount}`,
      hint: billing.t('当前仍可直接使用的套餐数量'),
    },
    {
      key: 'expired',
      label: billing.t('历史订阅'),
      value: `${billing.expiredSubscriptionCount}`,
      hint: billing.t('已结束或已失效的订阅记录'),
    },
    {
      key: 'remain',
      label: billing.t('主套餐剩余'),
      value: renderQuota(billing.primarySubscriptionRemain),
      hint: billing.t('按当前主套餐的剩余额度计算'),
    },
    {
      key: 'preference',
      label: billing.t('扣费偏好'),
      value: billing.billingPreferenceLabel,
      hint: billing.t('购买后会按此偏好参与扣费'),
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
              {billing.t('订阅中心')}
            </div>
            <h1 className='portal-overview__hero-title'>
              {billing.t('统一查看套餐状态、周期与续费入口')}
            </h1>
            <p className='portal-overview__hero-description'>
              {billing.t(
                '这里展示当前订阅状态、扣费偏好、剩余额度和最近账单，并直接承接升级与续费流程。',
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
              onClick={() => navigate('/app/wallet')}
            >
              {billing.t('查看钱包中心')}
            </Button>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconArrowRight />}
              onClick={() => navigate('/app/logs')}
            >
              {billing.t('查看扣费日志')}
            </Button>
          </div>
        </div>
        <div className='portal-overview__hero-side'>
          <div className='portal-overview__hero-kpi'>
            <span>{billing.t('当前主套餐')}</span>
            <strong>{billing.primarySubscriptionTitle}</strong>
            <small>
              {billing.primarySubscriptionRemainDays === null
                ? billing.t('未设置到期时间')
                : billing.t('预计剩余 {{days}} 天', {
                    days: billing.primarySubscriptionRemainDays,
                  })}
            </small>
          </div>
          <div className='portal-overview__hero-kpi'>
            <span>{billing.t('扣费偏好')}</span>
            <strong>{billing.billingPreferenceLabel}</strong>
            <small>{billing.billingSourceSummary}</small>
          </div>
        </div>
      </Card>

      <div className='portal-overview__metrics'>
        {subscriptionMetricCards.map((item) => (
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
                {billing.t('当前套餐状态')}
              </div>
              <h2>{billing.primarySubscriptionTitle}</h2>
            </div>
            <Tag
              color={billing.hasActiveSubscription ? 'green' : 'grey'}
              shape='circle'
            >
              {billing.hasActiveSubscription
                ? billing.t('生效中')
                : billing.t('暂无生效订阅')}
            </Tag>
          </div>
          <div className='portal-billing__summary-metrics'>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('已用额度')}</span>
              <strong>{renderQuota(billing.primarySubscriptionUsed)}</strong>
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
                {billing.t('账单来源说明')}
              </div>
              <h2>{billing.billingPreferenceLabel}</h2>
            </div>
          </div>
          <p className='portal-billing__description'>
            {billing.billingSourceSummary}
          </p>
          <div className='portal-billing__summary-metrics'>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('钱包余额')}</span>
              <strong>
                {renderQuota(billing.userState?.user?.quota || 0)}
              </strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('生效订阅')}</span>
              <strong>{billing.activeSubscriptionCount}</strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('可购套餐')}</span>
              <strong>
                {billing.subscriptionCardProps?.plans?.length || 0}
              </strong>
            </div>
          </div>
        </Card>
      </div>

      <div className='portal-billing__content-grid portal-billing__content-grid--subscription'>
        <div className='portal-billing__main'>
          <Card className='portal-panel portal-billing__plans' bordered={false}>
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>
                  {billing.t('升级与续费')}
                </div>
                <h2>{billing.t('可购买套餐与当前订阅偏好')}</h2>
              </div>
            </div>
            <SubscriptionPlansCard
              {...billing.subscriptionCardProps}
              withCard={false}
            />
          </Card>
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
                <h2>{billing.t('套餐购买与支付摘要')}</h2>
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
                title={billing.t('暂无套餐账单')}
                description={billing.t(
                  '完成套餐购买或续费后，这里会展示最近账单摘要。',
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
                  {billing.t('支付方式')}
                </div>
                <h2>{billing.t('套餐支付渠道')}</h2>
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
                  '当前尚未开启在线套餐支付，请联系管理员确认配置。',
                )}
              />
            )}
          </Card>
        </div>
      </div>

      <PortalBillingOverlays billing={billing} />
    </div>
  );
};

export default PortalSubscriptionPage;
