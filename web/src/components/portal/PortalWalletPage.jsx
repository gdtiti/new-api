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
    },
    {
      key: 'minimum',
      label: billing.t('最低充值'),
      value: renderQuotaWithAmount(billing.minTopUp || 0),
    },
    {
      key: 'preference',
      label: billing.t('扣费偏好'),
      value: billing.billingPreferenceLabel,
    },
  ];
  const showBillingSummaryCard =
    billing.hasActiveSubscription || billing.paymentMethodSummary.length > 0;
  const showRecentBillingCard = billing.recentBillingItems.length > 0;
  const showWalletSide = showBillingSummaryCard || showRecentBillingCard;

  return (
    <div className='portal-overview portal-billing'>
      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>
            {billing.t('钱包与额度')}
          </div>
          <h1 className='portal-page-head__title'>
            {billing.t('先看余额，再直接完成充值')}
          </h1>
        </div>
        <div className='portal-page-head__actions'>
          <Button
            theme='solid'
            type='primary'
            icon={<IconRefresh />}
            size='small'
            loading={billing.refreshing}
            onClick={billing.refreshAll}
          >
            {billing.t('刷新数据')}
          </Button>
          <Button
            theme='light'
            type='tertiary'
            icon={<IconArrowRight />}
            size='small'
            onClick={() => navigate('/app/subscription')}
          >
            {billing.t('订阅中心')}
          </Button>
          <Button
            theme='borderless'
            type='tertiary'
            icon={<IconArrowRight />}
            size='small'
            onClick={() => navigate('/app/logs')}
          >
            {billing.t('使用日志')}
          </Button>
        </div>
      </div>

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
            {item.hint ? (
              <small className='portal-overview__metric-hint'>{item.hint}</small>
            ) : null}
          </Card>
        ))}
      </div>

      <div
        className={`portal-billing__content-grid${showWalletSide ? '' : ' portal-billing__content-grid--single'}`}
      >
        <div className='portal-billing__main'>
          <RechargeCard
            {...billing.rechargeCardProps}
            subscriptionLoading={false}
            subscriptionPlans={[]}
          />
        </div>

        {showWalletSide ? (
          <div className='portal-billing__side'>
            <Card
              className='portal-panel portal-detail-panel portal-billing__side-card'
              bordered={false}
            >
              {showBillingSummaryCard ? (
                <>
                  <div className='portal-overview__section-head'>
                    <div>
                      <div className='portal-overview__eyebrow'>
                        {billing.t('当前扣费方式')}
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
                  {billing.hasActiveSubscription ? (
                    <>
                      <div className='portal-billing__summary-metrics'>
                        <div className='portal-billing__summary-item'>
                          <span>{billing.t('当前主套餐')}</span>
                          <strong>{billing.primarySubscriptionTitle}</strong>
                        </div>
                        <div className='portal-billing__summary-item'>
                          <span>{billing.t('剩余额度')}</span>
                          <strong>
                            {renderQuota(billing.primarySubscriptionRemain)}
                          </strong>
                        </div>
                      </div>
                      <Progress
                        percent={billing.primarySubscriptionUsagePercent}
                        stroke='#7c3aed'
                        showInfo
                        format={(percent) => `${percent}%`}
                      />
                    </>
                  ) : null}
                  <Button
                    theme='borderless'
                    type='tertiary'
                    icon={<IconArrowRight />}
                    onClick={() => navigate('/app/subscription')}
                  >
                    {billing.t('前往订阅中心')}
                  </Button>
                </>
              ) : null}

              {showRecentBillingCard ? (
                <div className='portal-billing__inline-section'>
                  {showBillingSummaryCard ? (
                    <div className='portal-billing__section-divider' />
                  ) : null}
                  <div className='portal-overview__section-head'>
                    <div>
                      <div className='portal-overview__eyebrow'>
                        {billing.t('最近账单')}
                      </div>
                      <h2>{billing.t('最近变化')}</h2>
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
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}
      </div>

      <PortalBillingOverlays billing={billing} />
    </div>
  );
};

export default PortalWalletPage;
