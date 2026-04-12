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
import { renderQuota } from '../../helpers';
import SubscriptionPlansCard from '../topup/SubscriptionPlansCard';
import usePortalBillingData from '../../hooks/portal/usePortalBillingData';
import PortalBillingOverlays from './PortalBillingOverlays';
import PortalStateBlock from './PortalStateBlock';

const PortalSubscriptionPage = () => {
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
    },
    {
      key: 'remain',
      label: billing.t('主套餐剩余'),
      value: billing.hasActiveSubscription
        ? renderQuota(billing.primarySubscriptionRemain)
        : billing.t('待开通'),
    },
    {
      key: 'preference',
      label: billing.t('优先扣费'),
      value: billing.billingPreferenceLabel,
      valueClassName: 'portal-overview__metric-value--compact',
    },
  ];
  const showRecentBillingCard = billing.recentBillingItems.length > 0;
  const showPaymentMethodsCard = billing.paymentMethodSummary.length > 0;
  const showSubscriptionSide = showRecentBillingCard;
  const showUsageProgress = billing.hasActiveSubscription;

  return (
    <div className='portal-overview portal-billing'>
      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{billing.t('订阅中心')}</div>
          <h1 className='portal-page-head__title'>
            {billing.t('先看当前套餐，再决定升级或续费')}
          </h1>
        </div>
        <div className='portal-page-head__actions'>
          <Button
            theme='solid'
            type='primary'
            icon={<IconRefresh />}
            loading={billing.refreshing}
            onClick={billing.refreshAll}
          >
            {billing.t('刷新数据')}
          </Button>
        </div>
      </div>

      <div className='portal-overview__metrics portal-overview__metrics--billing'>
        {subscriptionMetricCards.map((item) => (
          <Card
            key={item.key}
            className='portal-panel portal-overview__metric portal-overview__metric--compact'
            bordered={false}
          >
            <span className='portal-overview__metric-label'>{item.label}</span>
            <strong
              className={`portal-overview__metric-value${item.valueClassName ? ` ${item.valueClassName}` : ''}`}
            >
              {item.value}
            </strong>
            {item.hint ? (
              <small className='portal-overview__metric-hint'>{item.hint}</small>
            ) : null}
          </Card>
        ))}
      </div>

      <div className='portal-billing__summary-grid portal-billing__summary-grid--single'>
        <Card
          className='portal-panel portal-billing__summary portal-billing__summary--subscription'
          bordered={false}
        >
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
              <strong>
                {billing.hasActiveSubscription
                  ? renderQuota(billing.primarySubscriptionUsed)
                  : billing.t('待开通')}
              </strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('剩余额度')}</span>
              <strong>
                {billing.hasActiveSubscription
                  ? renderQuota(billing.primarySubscriptionRemain)
                  : billing.t('待开通')}
              </strong>
            </div>
            <div className='portal-billing__summary-item'>
              <span>{billing.t('剩余天数')}</span>
              <strong>
                {!billing.hasActiveSubscription
                  ? billing.t('待开通')
                  : billing.primarySubscriptionRemainDays === null
                    ? billing.t('未设置')
                  : billing.t('{{days}} 天', {
                      days: billing.primarySubscriptionRemainDays,
                    })}
              </strong>
            </div>
          </div>
          {showUsageProgress ? (
            <div className='portal-billing__summary-progress'>
              <Progress
                percent={billing.primarySubscriptionUsagePercent}
                stroke='#7c3aed'
                showInfo
                format={(percent) => `${percent}%`}
              />
            </div>
          ) : (
            <div className='portal-billing__summary-note'>
              <strong>{billing.t('当前还没有生效套餐')}</strong>
              <span>
                {billing.t(
                  '选择下方套餐后，这里会显示额度占用、到期时间和续费状态。',
                )}
              </span>
            </div>
          )}
          {showPaymentMethodsCard ? (
            <div className='portal-billing__inline-section'>
              <div className='portal-overview__eyebrow'>
                {billing.t('支付方式')}
              </div>
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
            </div>
          ) : null}
        </Card>
      </div>

      <div
        className={`portal-billing__content-grid portal-billing__content-grid--subscription${showSubscriptionSide ? '' : ' portal-billing__content-grid--single'}`}
      >
        <div className='portal-billing__main'>
          <Card className='portal-panel portal-billing__plans' bordered={false}>
              <div className='portal-overview__section-head'>
                <div>
                  <div className='portal-overview__eyebrow'>
                    {billing.t('升级与续费')}
                  </div>
                  <h2>{billing.t('可购买套餐')}</h2>
                </div>
              </div>
            <SubscriptionPlansCard
              {...billing.subscriptionCardProps}
              withCard={false}
            />
          </Card>
        </div>

        {showSubscriptionSide ? (
          <div className='portal-billing__side'>
            {showRecentBillingCard ? (
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
              </Card>
            ) : null}

          </div>
        ) : null}
      </div>

      <PortalBillingOverlays billing={billing} />
    </div>
  );
};

export default PortalSubscriptionPage;
